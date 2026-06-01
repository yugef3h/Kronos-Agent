import type { KnowledgeSearchMethod } from '../../models/knowledgeDatasetStore.js';

/** 检索缓存键组成部分 */
export type RetrievalCacheKeyParts = {
  query: string;
  datasetIds: string[];
  searchMethod: KnowledgeSearchMethod;
  topK: number;
  /** 各知识库当前版本号，用于版本化缓存失效 */
  datasetVersions: Record<string, number>;
};
