/**
 * 知识库 HTTP 使用的唯一入口。
 *
 * Step3：`langchain` 时预览/入库切分用 `RecursiveCharacterTextSplitter`（见 `langchain/buildChunksWithLangChain`）。
 * Step4：`langchain` 时入库后把 chunk 向量写入 jsonl；检索走 `runLangchainVectorRetrievalQuery`（同一 `createRagEmbeddings()` 与入库一致；多 query 极大余弦语义 + 自研混合权重/rerank；可选 `RAG_LC_MULTI_QUERY` 见 `expandRetrievalQueries.ts`）。
 * `self` 时检索/入库仍委托 `knowledgeRetrievalService` / `knowledgeDocumentStore` 自研实现。
 */
import { getKnowledgeDatasetById } from '../domain/knowledgeDatasetStore.js';
import {
  importKnowledgeDocument as selfHostedImportKnowledgeDocument,
  mergeEmbeddingsIntoChunkFile,
  persistImportedDocument,
  previewKnowledgeDocuments as selfHostedPreviewKnowledgeDocuments,
} from '../domain/knowledgeDocumentStore.js';
import type {
  KnowledgeDocumentChunkOptions,
  KnowledgeDocumentPreprocessingRules,
} from '../services/knowledgeChunkingService.js';
import type { KnowledgeRetrievalQuery } from '../services/knowledgeRetrievalService.js';
import { runKnowledgeRetrievalQuery as selfHostedRunKnowledgeRetrievalQuery } from '../services/knowledgeRetrievalService.js';
import { getRagEngineMode } from './engine.js';
import { buildKnowledgeDocumentChunksWithLangChain } from './langchain/buildChunksWithLangChain.js';
import { createRagEmbeddings } from './langchain/ragEmbeddings.js';
import { runLangchainVectorRetrievalQuery } from './langchain/vectorRetrieval.js';

export {
  createKnowledgeDataset,
  deleteKnowledgeDataset,
  listKnowledgeDatasets,
  updateKnowledgeDataset,
} from '../domain/knowledgeDatasetStore.js';
export {
  deleteKnowledgeDatasetFiles,
  getKnowledgeDocumentBlocks,
  listKnowledgeDocuments,
  updateKnowledgeDocumentBlockKeywords,
} from '../domain/knowledgeDocumentStore.js';
export { runKnowledgeIndexingEstimate } from '../services/knowledgeIndexingEstimateService.js';
export { getRagEngineMode, type RagEngineMode } from './engine.js';
export type {
  KnowledgeRetrievalQuery,
  KnowledgeRetrievalQueryResult,
  KnowledgeRetrievalResultItem,
} from '../services/knowledgeRetrievalService.js';

export async function runKnowledgeRetrievalQuery(query: KnowledgeRetrievalQuery) {
  /** Step4：门面按 `RAG_ENGINE_MODE` 切换自研打分检索 vs 向量检索（契约相同）。 */
  if (getRagEngineMode() !== 'langchain') {
    return selfHostedRunKnowledgeRetrievalQuery(query);
  }
  return runLangchainVectorRetrievalQuery(query);
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

  const result = await buildKnowledgeDocumentChunksWithLangChain(params);
  const persisted = await persistImportedDocument({
    dataset,
    fileName: params.fileName,
    mimeType: result.mimeType,
    buffer: result.buffer,
    extractedText: result.processedText,
    chunks: result.chunks,
    metadata: { ...(params.metadata ?? {}) },
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
    await mergeEmbeddingsIntoChunkFile(persisted.record.chunkPath, byId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.warn(`[rag/langchain] chunk embedding persist failed (retrieval will embed on-the-fly): ${message}`);
  }

  return {
    document: persisted.record,
    preview: persisted.preview,
  };
}
