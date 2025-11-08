/**
 * 知识库 HTTP 使用的唯一入口。
 * `RAG_ENGINE_MODE=langchain`：预览与入库切分走 LangChain `RecursiveCharacterTextSplitter`；解析、预处理与 jsonl 落盘与自研一致。
 */
import { getKnowledgeDatasetById } from '../domain/knowledgeDatasetStore.js';
import {
  importKnowledgeDocument as selfHostedImportKnowledgeDocument,
  persistImportedDocument,
  previewKnowledgeDocuments as selfHostedPreviewKnowledgeDocuments,
} from '../domain/knowledgeDocumentStore.js';
import type {
  KnowledgeDocumentChunkOptions,
  KnowledgeDocumentPreprocessingRules,
} from '../services/knowledgeChunkingService.js';
import { getRagEngineMode } from './engine.js';
import { buildKnowledgeDocumentChunksWithLangChain } from './langchain/buildChunksWithLangChain.js';

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
export { runKnowledgeRetrievalQuery } from '../services/knowledgeRetrievalService.js';
export { getRagEngineMode, type RagEngineMode } from './engine.js';

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

  return {
    document: persisted.record,
    preview: persisted.preview,
  };
}
