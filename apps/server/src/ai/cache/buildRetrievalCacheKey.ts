import type { RetrievalCacheKeyParts } from '../types/retrievalCacheKeyParts.js';
import { hashCacheKey } from './hashCacheKey.js';

/** 向量检索结果缓存键 */
export const buildRetrievalCacheKey = (parts: RetrievalCacheKeyParts): string => hashCacheKey('retrieval', {
  query: parts.query.trim(),
  datasetIds: [...parts.datasetIds].sort().join(','),
  searchMethod: parts.searchMethod,
  topK: parts.topK,
});
