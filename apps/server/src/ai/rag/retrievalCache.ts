import type {
  KnowledgeRetrievalQueryResult,
} from '../../services/knowledgeRetrievalService.js';
import type { RetrievalCacheKeyParts } from '../types/retrievalCacheKeyParts.js';
import { buildRetrievalCacheKey } from '../cache/buildRetrievalCacheKey.js';
import { getCacheStore } from '../cache/getCacheStore.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** R-09: 检索缓存读 */
export const getCachedRetrieval = async (
  parts: RetrievalCacheKeyParts,
): Promise<KnowledgeRetrievalQueryResult | null> => {
  const entry = await getCacheStore().get(buildRetrievalCacheKey(parts));
  return (entry?.value as KnowledgeRetrievalQueryResult | undefined) ?? null;
};

/** R-09: 检索缓存写 */
export const setCachedRetrieval = async (
  parts: RetrievalCacheKeyParts,
  value: KnowledgeRetrievalQueryResult,
  ttlMs = DEFAULT_TTL_MS,
): Promise<void> => {
  await getCacheStore().set(buildRetrievalCacheKey(parts), value, ttlMs);
};
