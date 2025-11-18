import { getKnowledgeDatasetById } from '../../domain/knowledgeDatasetStore.js';
import {
  listKnowledgeDatasetChunks,
  mergeEmbeddingsIntoChunkFile,
  type KnowledgeDatasetChunkRecord,
} from '../../domain/knowledgeDocumentStore.js';
import {
  applyReranking,
  clampUnitScore,
  getTermCandidates,
  matchesMetadataFilter,
  normalizeText,
  resolveThreshold,
  resolveTopK,
  scoreBySearchMethod,
  type KnowledgeRetrievalQuery,
  type KnowledgeRetrievalQueryResult,
  type RankedChunk,
} from '../../services/knowledgeRetrievalService.js';
import { maybeExpandQueriesForLangchainRetrieval } from './expandRetrievalQueries.js';
import { createRagEmbeddings } from './ragEmbeddings.js';

// 余弦相似度
const cosineSimilarity = (left: number[], right: number[]): number => {
  const len = Math.min(left.length, right.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let index = 0; index < len; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    na += a * a;
    nb += b * b;
  }
  if (!na || !nb) {
    return 0;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

// 余弦相似度转换为0-1分数
const vectorSimilarityToUnit = (cos: number) => clampUnitScore((Math.min(Math.max(cos, -1), 1) + 1) / 2);

/**
 * Step4 — LangChain 检索分支（向量语义 + 自研混合/rerank）
 *
 * 1) 与自研相同的 dataset 加载、元数据过滤、TopK/阈值/rerank 分支。
 * 2) 对「缺 embedding」的 chunk：`embedDocuments` 批量算向量，`mergeEmbeddingsIntoChunkFile` 写回 jsonl，下次可走磁盘向量。
 * 3) 语义通道：可选多 query（`maybeExpandQueriesForLangchainRetrieval`）与各 chunk 向量余弦取极大值 → 压到 0–1，作为 `scoreBySearchMethod` 的 `semanticOverride`；
 *    关键词 / full_text 及 hybrid 权重仍走自研 `scoreBySearchMethod`，保证与 HTTP 契约一致。
 */
export async function runLangchainVectorRetrievalQuery(
  query: KnowledgeRetrievalQuery,
): Promise<KnowledgeRetrievalQueryResult> {
  const datasets = await Promise.all(
    [...new Set(query.dataset_ids)].map(async (datasetId) => {
      const dataset = await getKnowledgeDatasetById(datasetId);
      if (!dataset) {
        throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
      }
      return dataset;
    }),
  );

  const queryTerms = getTermCandidates(query.query);
  const chunkGroups = await Promise.all(datasets.map(async (dataset) => ({
    dataset,
    chunks: await listKnowledgeDatasetChunks(dataset.id),
  })));

  const totalChunkCount = chunkGroups.reduce((sum, item) => sum + item.chunks.length, 0);
  const candidates: KnowledgeDatasetChunkRecord[] = [];

  for (const item of chunkGroups) {
    for (const chunkRecord of item.chunks) {
      if (matchesMetadataFilter(query, chunkRecord)) {
        candidates.push(chunkRecord);
      }
    }
  }

  const filteredChunkCount = candidates.length;
  const embeddings = createRagEmbeddings();
  // 多查询改写
  const queryTexts = await maybeExpandQueriesForLangchainRetrieval(query.query);

  /** 仅元数据通过的 chunk；缺向量的将进入 embed + 回写 jsonl。 */
  const needEmbed: KnowledgeDatasetChunkRecord[] = [];
  for (const record of candidates) {
    const emb = record.chunk.embedding;
    if (!Array.isArray(emb) || emb.length === 0) {
      needEmbed.push(record);
    }
  }

  const pathToNewVectors: Record<string, Record<string, number[]>> = {};

  /** 批量向量化并持久化到各 document 的 chunks.jsonl（按 chunkPath 分组）。 */
  if (needEmbed.length) {
    const texts = needEmbed.map((record) => record.chunk.text);
    const batchSize = 16;
    const allVectors: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += batchSize) {
      const slice = texts.slice(offset, offset + batchSize);
      const part = await embeddings.embedDocuments(slice);
      allVectors.push(...part);
    }

    needEmbed.forEach((record, index) => {
      const vector = allVectors[index];
      if (!vector?.length) {
        return;
      }
      const path = record.document.chunkPath;
      if (!pathToNewVectors[path]) {
        pathToNewVectors[path] = {};
      }
      pathToNewVectors[path][record.chunk.id] = vector;
    });

    await Promise.all(
      Object.entries(pathToNewVectors).map(([chunkPath, byId]) => mergeEmbeddingsIntoChunkFile(chunkPath, byId)),
    );
  }

  // 批量向量化
  const queryVectors = await Promise.all(queryTexts.map((text) => embeddings.embedQuery(text)));

  /** 打分：余弦→语义 override，再与 keyword/full_text 按数据集 search_method 融合。 */
  const ranked: RankedChunk[] = [];

  for (const item of chunkGroups) {
    for (const chunkRecord of item.chunks) {
      if (!matchesMetadataFilter(query, chunkRecord)) {
        continue;
      }

      let chunkVector = chunkRecord.chunk.embedding;
      if (!Array.isArray(chunkVector) || !chunkVector.length) {
        const fromDisk = pathToNewVectors[chunkRecord.document.chunkPath]?.[chunkRecord.chunk.id];
        chunkVector = fromDisk;
      }
      if (!Array.isArray(chunkVector) || !chunkVector.length) {
        continue;
      }

      // 向量语义打分
      const vectorSemantic = Math.max(
        ...queryVectors.map((queryVector) => vectorSimilarityToUnit(cosineSimilarity(queryVector, chunkVector))),
      );

      const searchMethod = query.retrieval_mode === 'oneWay'
        ? 'semantic_search'
        : item.dataset.retrieval_model.search_method;

      const scores = scoreBySearchMethod({
        dataset: query.retrieval_mode === 'oneWay'
          ? {
              ...item.dataset,
              retrieval_model: {
                ...item.dataset.retrieval_model,
                search_method: searchMethod,
              },
            }
          : item.dataset,
        query: query.query,
        text: chunkRecord.chunk.text,
        queryTerms,
        semanticOverride: vectorSemantic,
      });

      const threshold = resolveThreshold({ query, dataset: item.dataset });
      if (typeof threshold === 'number' && scores.finalScore < threshold) {
        continue;
      }

      ranked.push({
        dataset_id: item.dataset.id,
        dataset_name: item.dataset.name,
        document_id: chunkRecord.document.id,
        document_name: chunkRecord.document.name,
        chunk_id: chunkRecord.chunk.id,
        chunk_index: chunkRecord.chunk.index,
        text: chunkRecord.chunk.text,
        score: scores.finalScore,
        search_method: searchMethod,
        matched_terms: [...new Set(queryTerms.filter((term) => normalizeText(chunkRecord.chunk.text).includes(term)))],
        metadata: { ...chunkRecord.chunk.metadata },
        token_count: chunkRecord.chunk.tokenCount,
        char_count: chunkRecord.chunk.charCount,
        _semantic_score: scores.semantic,
        _keyword_score: scores.keyword,
        _full_text_score: scores.fullText,
      });
    }
  }

  const topK = resolveTopK({ query, datasets });
  const sorted = ranked
    .sort((left, right) => right.score - left.score || left.chunk_index - right.chunk_index)
    .slice(0, Math.max(1, topK));
  const reranked = query.retrieval_mode === 'multiWay' && query.multiple_retrieval_config.reranking_enable
    ? applyReranking({ items: sorted, query: query.query, queryTerms })
    : sorted;

  return {
    query: query.query,
    items: reranked.map(({ _semantic_score, _keyword_score, _full_text_score, ...item }) => item),
    diagnostics: {
      retrieval_mode: query.retrieval_mode,
      dataset_count: datasets.length,
      total_chunk_count: totalChunkCount,
      filtered_chunk_count: filteredChunkCount,
      // 多查询改写
      ...(queryTexts.length > 1 ? { langchain_query_variants: queryTexts.length } : {}),
    },
  };
}
