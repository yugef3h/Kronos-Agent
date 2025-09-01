import {
  getKnowledgeDatasetById,
  type KnowledgeDatasetRecord,
  type KnowledgeSearchMethod,
} from '../domain/knowledgeDatasetStore.js';
import {
  listKnowledgeDatasetChunks,
  type KnowledgeDatasetChunkRecord,
} from '../domain/knowledgeDocumentStore.js';

export type KnowledgeRetrievalMode = 'oneWay' | 'multiWay';
export type KnowledgeMetadataFilteringMode = 'disabled' | 'manual';
export type KnowledgeMetadataOperator = 'contains' | 'equals' | 'not_equals';

export type KnowledgeMetadataCondition = {
  id?: string;
  field: string;
  operator: KnowledgeMetadataOperator;
  value: string;
};

export type KnowledgeSingleRetrievalConfig = {
  model: string;
  top_k: number;
  score_threshold: number | null;
};

export type KnowledgeMultiRetrievalConfig = {
  top_k: number;
  score_threshold: number | null;
  reranking_enable: boolean;
  reranking_model?: string;
};

export type KnowledgeRetrievalQuery = {
  query: string;
  dataset_ids: string[];
  retrieval_mode: KnowledgeRetrievalMode;
  single_retrieval_config: KnowledgeSingleRetrievalConfig;
  multiple_retrieval_config: KnowledgeMultiRetrievalConfig;
  metadata_filtering_mode: KnowledgeMetadataFilteringMode;
  metadata_filtering_conditions: KnowledgeMetadataCondition[];
};

export type KnowledgeRetrievalResultItem = {
  dataset_id: string;
  dataset_name: string;
  document_id: string;
  document_name: string;
  chunk_id: string;
  chunk_index: number;
  text: string;
  score: number;
  search_method: KnowledgeSearchMethod;
  matched_terms: string[];
  metadata: Record<string, string>;
  token_count: number;
  char_count: number;
};

export type KnowledgeRetrievalQueryResult = {
  query: string;
  items: KnowledgeRetrievalResultItem[];
  diagnostics: {
    retrieval_mode: KnowledgeRetrievalMode;
    dataset_count: number;
    total_chunk_count: number;
    filtered_chunk_count: number;
  };
};

type RankedChunk = KnowledgeRetrievalResultItem & {
  _semantic_score: number;
  _keyword_score: number;
  _full_text_score: number;
};

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const getTermCandidates = (value: string) => {
  const matches = normalizeText(value).match(/[\p{L}\p{N}\u4e00-\u9fff]+/gu) ?? [];
  return [...new Set(matches.flatMap((item) => {
    if (!item.length) {
      return [] as string[];
    }

    if (/^[\u4e00-\u9fff]+$/u.test(item) && item.length > 1) {
      const segments = new Set<string>([item]);
      for (let index = 0; index < item.length - 1; index += 1) {
        segments.add(item.slice(index, index + 2));
      }
      return [...segments];
    }

    return [item];
  }))];
};

const getTextBigrams = (value: string) => {
  const compact = normalizeText(value).replace(/\s+/g, '');
  if (!compact) {
    return [] as string[];
  }

  if (compact.length === 1) {
    return [compact];
  }

  const bigrams: string[] = [];
  for (let index = 0; index < compact.length - 1; index += 1) {
    bigrams.push(compact.slice(index, index + 2));
  }
  return bigrams;
};

const computeTokenOverlapScore = (queryTerms: string[], text: string) => {
  if (!queryTerms.length) {
    return 0;
  }

  const normalizedText = normalizeText(text);
  const uniqueTerms = [...new Set(queryTerms)];
  const matchedTerms = uniqueTerms.filter((term) => normalizedText.includes(term));
  return matchedTerms.length / uniqueTerms.length;
};

const computeFullTextScore = (query: string, text: string, queryTerms: string[]) => {
  const normalizedQuery = normalizeText(query);
  const normalizedText = normalizeText(text);
  if (!normalizedQuery || !normalizedText) {
    return 0;
  }

  if (normalizedText.includes(normalizedQuery)) {
    return 1;
  }

  const tokenCoverage = computeTokenOverlapScore(queryTerms, text);
  if (tokenCoverage === 0) {
    return 0;
  }

  const firstMatchIndex = queryTerms
    .map((term) => normalizedText.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (typeof firstMatchIndex !== 'number') {
    return tokenCoverage * 0.6;
  }

  const densityPenalty = Math.min(1, normalizedQuery.length / Math.max(normalizedText.length - firstMatchIndex, 1));
  return Math.min(1, tokenCoverage * 0.7 + densityPenalty * 0.3);
};

const computeSemanticScore = (query: string, text: string, queryTerms: string[]) => {
  const left = getTextBigrams(query);
  const right = getTextBigrams(text);
  if (!left.length || !right.length) {
    return computeTokenOverlapScore(queryTerms, text);
  }

  const rightSet = new Set(right);
  const overlap = left.filter((item) => rightSet.has(item)).length;
  const dice = (2 * overlap) / (left.length + right.length);
  const tokenCoverage = computeTokenOverlapScore(queryTerms, text);
  return Math.min(1, dice * 0.65 + tokenCoverage * 0.35);
};

const clampUnitScore = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
};

const scoreBySearchMethod = (params: {
  dataset: KnowledgeDatasetRecord;
  query: string;
  text: string;
  queryTerms: string[];
}) => {
  const keyword = clampUnitScore(computeTokenOverlapScore(params.queryTerms, params.text));
  const fullText = clampUnitScore(computeFullTextScore(params.query, params.text, params.queryTerms));
  const semantic = clampUnitScore(computeSemanticScore(params.query, params.text, params.queryTerms));

  let finalScore = semantic;
  switch (params.dataset.retrieval_model.search_method) {
    case 'keyword_search':
      finalScore = keyword;
      break;
    case 'full_text_search':
      finalScore = fullText;
      break;
    case 'hybrid_search': {
      const weights = params.dataset.retrieval_model.weights;
      const totalWeight = Math.max(weights.semantic + weights.keyword + weights.full_text, 0.0001);
      finalScore = (
        semantic * weights.semantic
        + keyword * weights.keyword
        + fullText * weights.full_text
      ) / totalWeight;
      break;
    }
    case 'semantic_search':
    default:
      finalScore = semantic;
      break;
  }

  return {
    semantic,
    keyword,
    fullText,
    finalScore: clampUnitScore(finalScore),
  };
};

const resolveTopK = (params: {
  query: KnowledgeRetrievalQuery;
  datasets: KnowledgeDatasetRecord[];
}) => {
  if (params.query.retrieval_mode === 'oneWay') {
    return params.query.single_retrieval_config.top_k;
  }

  return params.query.multiple_retrieval_config.top_k
    || Math.max(...params.datasets.map((dataset) => dataset.retrieval_model.top_k), 5);
};

const resolveThreshold = (params: {
  query: KnowledgeRetrievalQuery;
  dataset: KnowledgeDatasetRecord;
}) => {
  if (params.query.retrieval_mode === 'oneWay') {
    return params.query.single_retrieval_config.score_threshold;
  }

  if (typeof params.query.multiple_retrieval_config.score_threshold === 'number') {
    return params.query.multiple_retrieval_config.score_threshold;
  }

  if (params.dataset.retrieval_model.score_threshold_enabled) {
    return params.dataset.retrieval_model.score_threshold;
  }

  return null;
};

const matchesMetadataCondition = (
  metadata: Record<string, string>,
  condition: KnowledgeMetadataCondition,
) => {
  const candidate = metadata[condition.field] ?? '';
  const left = normalizeText(candidate);
  const right = normalizeText(condition.value);

  if (!right) {
    return true;
  }

  switch (condition.operator) {
    case 'equals':
      return left === right;
    case 'not_equals':
      return left !== right;
    case 'contains':
    default:
      return left.includes(right);
  }
};

const matchesMetadataFilter = (query: KnowledgeRetrievalQuery, chunk: KnowledgeDatasetChunkRecord) => {
  if (query.metadata_filtering_mode !== 'manual' || !query.metadata_filtering_conditions.length) {
    return true;
  }

  return query.metadata_filtering_conditions.every((condition) => matchesMetadataCondition(chunk.chunk.metadata, condition));
};

const applyReranking = (params: {
  items: RankedChunk[];
  query: string;
  queryTerms: string[];
}) => {
  return params.items
    .map((item) => {
      const normalizedText = normalizeText(item.text);
      const normalizedQuery = normalizeText(params.query);
      const documentName = normalizeText(item.document_name);
      const containsWholeQuery = normalizedQuery ? normalizedText.includes(normalizedQuery) : false;
      const matchedTerms = params.queryTerms.filter((term) => normalizedText.includes(term));
      const titleBoost = params.queryTerms.some((term) => documentName.includes(term)) ? 0.08 : 0;
      const rerankBoost = (containsWholeQuery ? 0.18 : 0) + (matchedTerms.length ? matchedTerms.length / Math.max(params.queryTerms.length, 1) * 0.12 : 0) + titleBoost;

      return {
        ...item,
        score: clampUnitScore(item.score + rerankBoost),
      };
    })
    .sort((left, right) => right.score - left.score || left.chunk_index - right.chunk_index);
};

export const runKnowledgeRetrievalQuery = async (
  query: KnowledgeRetrievalQuery,
): Promise<KnowledgeRetrievalQueryResult> => {
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
  const ranked: RankedChunk[] = [];
  let filteredChunkCount = 0;

  for (const item of chunkGroups) {
    for (const chunkRecord of item.chunks) {
      if (!matchesMetadataFilter(query, chunkRecord)) {
        continue;
      }

      filteredChunkCount += 1;

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
    },
  };
};