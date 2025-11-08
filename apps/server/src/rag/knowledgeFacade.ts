/**
 * 知识库 HTTP 使用的唯一入口。Step 1：`langchain` 与 `self` 均委托自研实现；后续在 `langchain/` 落地流水线。
 */
export {
  createKnowledgeDataset,
  deleteKnowledgeDataset,
  listKnowledgeDatasets,
  updateKnowledgeDataset,
} from '../domain/knowledgeDatasetStore.js';
export {
  deleteKnowledgeDatasetFiles,
  getKnowledgeDocumentBlocks,
  importKnowledgeDocument,
  listKnowledgeDocuments,
  previewKnowledgeDocuments,
  updateKnowledgeDocumentBlockKeywords,
} from '../domain/knowledgeDocumentStore.js';
export { runKnowledgeIndexingEstimate } from '../services/knowledgeIndexingEstimateService.js';
export { runKnowledgeRetrievalQuery } from '../services/knowledgeRetrievalService.js';

export { getRagEngineMode, type RagEngineMode } from './engine.js';
