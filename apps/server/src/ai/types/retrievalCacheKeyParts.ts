import type { KnowledgeSearchMethod } from '../../domain/knowledgeDatasetStore.js';

/** 检索缓存键组成部分 */
export type RetrievalCacheKeyParts = {
  query: string;
  datasetIds: string[];
  searchMethod: KnowledgeSearchMethod;
  topK: number;
};
