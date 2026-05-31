import type { KnowledgeSearchMethod } from '../../models/knowledgeDatasetStore.js';

/** 检索缓存键组成部分 */
export type RetrievalCacheKeyParts = {
  query: string;
  datasetIds: string[];
  searchMethod: KnowledgeSearchMethod;
  topK: number;
};
