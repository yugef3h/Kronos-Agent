/**
 * 知识库 HTTP / 工作流检索的唯一服务端入口。
 *
 * 【检索主路径】`runKnowledgeRetrievalQuery`（本文件末尾）：
 *   用户 query →（可选）`maybeExpandRetrievalQueries` 用 LLM 改写问句
 *   → 加载 dataset chunk → 打分 / 向量相似度 → Top-K →（可选）rerank
 *   → 返回 `items[]`（仅结构化片段，不调用 LLM 做答案整理）。
 *   检索结果如何「整理、突出」：由调用方拼进 Prompt 后走 `/api/chat-stream` 或工作流 LLM 节点。
 *
 * Step3：`langchain` 时预览/入库切分用 `RecursiveCharacterTextSplitter`（见 `langchain/buildChunksWithLangChain`）。
 * Step4：`langchain` 时入库后把 chunk 向量写入 jsonl；检索走 `runLangchainVectorRetrievalQuery`。
 * `self` 时检索/入库仍委托 `knowledgeRetrievalService` / `knowledgeDocumentStore`。
 */
import { getKnowledgeDatasetById } from '../models/knowledgeDatasetStore.js';
import {
  importKnowledgeDocument as selfHostedImportKnowledgeDocument,
  mergeEmbeddingsIntoChunkFile,
  persistImportedDocument,
  previewKnowledgeDocuments as selfHostedPreviewKnowledgeDocuments,
} from '../models/knowledgeDocumentStore.js';
import type {
  KnowledgeDocumentChunkOptions,
  KnowledgeDocumentPreprocessingRules,
} from '../services/knowledge/knowledgeChunkingService.js';
import type { KnowledgeRetrievalQuery } from '../services/knowledge/knowledgeRetrievalService.js';
import { runKnowledgeRetrievalQuery as selfHostedRunKnowledgeRetrievalQuery } from '../services/knowledge/knowledgeRetrievalService.js';
import { computeKnowledgeDocumentContentHash } from '../models/knowledgeContentHash.js';
import { assertNoDuplicateDocument } from '../models/knowledgeDocumentDuplicate.js';
import { resolveImportPreprocessingRules } from '../services/knowledge/knowledgeImportPreprocessing.js';
import { getRagEngineMode } from './engine.js';
import { buildKnowledgeDocumentChunksWithLangChain } from './langchain/buildChunksWithLangChain.js';
import { createRagEmbeddings } from './langchain/ragEmbeddings.js';
import { withRetrievalCache } from '../ai/rag/cachedKnowledgeRetrieval.js';
import { runLangchainVectorRetrievalQuery } from './langchain/vectorRetrieval.js';

export {
  createKnowledgeDataset,
  deleteKnowledgeDataset,
  listKnowledgeDatasets,
  updateKnowledgeDataset,
} from '../models/knowledgeDatasetStore.js';
export {
  deleteKnowledgeDatasetFiles,
  getKnowledgeDocumentBlocks,
  listKnowledgeDocuments,
  updateKnowledgeDocumentBlockKeywords,
} from '../models/knowledgeDocumentStore.js';
export { runKnowledgeIndexingEstimate } from '../services/knowledge/knowledgeIndexingEstimateService.js';
export { getRagEngineMode, type RagEngineMode } from './engine.js';
export type {
  KnowledgeRetrievalQuery,
  KnowledgeRetrievalQueryResult,
  KnowledgeRetrievalResultItem,
} from '../services/knowledge/knowledgeRetrievalService.js';

/** 知识库检索 API 与 Chatbot 编排共用的实现；输出 Top-K chunk，不含生成式答案。 */
export async function runKnowledgeRetrievalQuery(query: KnowledgeRetrievalQuery) {
  return withRetrievalCache(query, async (q) => {
    // `RAG_ENGINE_MODE=self` → 自研 hybrid/keyword/semantic；`langchain` → 向量 + 自研混合/rerank
    if (getRagEngineMode() !== 'langchain') {
      return selfHostedRunKnowledgeRetrievalQuery(q);
    }
    return runLangchainVectorRetrievalQuery(q);
  });
}

export async function previewKnowledgeDocuments(params: {
  inputs: KnowledgeDocumentChunkOptions[];
  previewLimit?: number;
}) {
  if (getRagEngineMode() !== 'langchain') {
    return selfHostedPreviewKnowledgeDocuments(params);
  }

  const previewLimit = Math.max(1, params.previewLimit ?? 40);
  const items = [];

  for (const input of params.inputs) {
    const result = await buildKnowledgeDocumentChunksWithLangChain(input);
    items.push({
      fileName: input.fileName,
      mimeType: result.mimeType,
      totalChunks: result.chunks.length,
      preview: result.chunks.slice(0, previewLimit),
    });
  }

  return { items };
}

export async function importKnowledgeDocument(params: {
  datasetId: string;
  fileName: string;
  fileDataUrl: string;
  mimeType?: string;
  maxTokens?: number;
  chunkOverlap?: number;
  separator?: string;
  segmentMaxLength?: number;
  overlapLength?: number;
  preprocessingRules?: KnowledgeDocumentPreprocessingRules;
  metadata?: Record<string, string>;
}) {
  if (getRagEngineMode() !== 'langchain') {
    return selfHostedImportKnowledgeDocument(params);
  }

  const dataset = await getKnowledgeDatasetById(params.datasetId);
  if (!dataset) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const preprocessingRules = resolveImportPreprocessingRules(dataset, params.preprocessingRules);
  const result = await buildKnowledgeDocumentChunksWithLangChain({
    ...params,
    preprocessingRules,
  });
  const contentHash = computeKnowledgeDocumentContentHash(result.processedText);
  await assertNoDuplicateDocument({
    datasetId: params.datasetId,
    fileName: params.fileName,
    contentHash,
    dataset,
    extractedText: result.processedText,
    preprocessingRules,
  });

  const persisted = await persistImportedDocument({
    dataset,
    fileName: params.fileName,
    mimeType: result.mimeType,
    buffer: result.buffer,
    extractedText: result.processedText,
    chunks: result.chunks,
    metadata: { ...(params.metadata ?? {}) },
    contentHash,
  });

  /**
   * Step4：入库成功后把各 chunk 文本编成向量，合并进 `chunks.jsonl`（`StoredChunk.embedding`）。
   * 失败不阻断入库；首次检索会在 `vectorRetrieval` 内补 embed 并尝试再次落盘。
   */
  try {
    const embeddings = createRagEmbeddings();
    const texts = result.chunks.map((chunk) => chunk.text);
    const vectors = await embeddings.embedDocuments(texts);
    const byId: Record<string, number[]> = {};
    result.chunks.forEach((chunk, index) => {
      const vector = vectors[index];
      if (vector?.length) {
        byId[chunk.id] = vector;
      }
    });
    await mergeEmbeddingsIntoChunkFile(persisted.record.datasetId, persisted.record.chunkPath, byId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.warn(`[rag/langchain] chunk embedding persist failed (retrieval will embed on-the-fly): ${message}`);
  }

  return {
    document: persisted.record,
    preview: persisted.preview,
  };
}
