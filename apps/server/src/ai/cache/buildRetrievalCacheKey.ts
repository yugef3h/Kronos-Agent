import type { RetrievalCacheKeyParts } from '../types/retrievalCacheKeyParts.js';
import { hashCacheKey } from './hashCacheKey.js';

/** 将版本号映射序列化为稳定字符串 */
const serializeVersions = (versions: Record<string, number>): string =>
  Object.keys(versions)
    .sort()
    .map((id) => `${id}@${versions[id]}`)
    .join('|');

/** 向量检索结果缓存键（含知识库版本，文档变更自动失效） */
export const buildRetrievalCacheKey = (parts: RetrievalCacheKeyParts): string => hashCacheKey('retrieval', {
  query: parts.query.trim(),
  datasetIds: [...parts.datasetIds].sort().join(','),
  searchMethod: parts.searchMethod,
  topK: parts.topK,
  datasetVersions: serializeVersions(parts.datasetVersions),
});
