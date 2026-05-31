import type {
  KnowledgeRetrievalQuery,
  KnowledgeRetrievalQueryResult,
} from '../../services/knowledge/knowledgeRetrievalService.js';
import { buildRetrievalCacheKey } from '../cache/buildRetrievalCacheKey.js';
import { getCacheStore } from '../cache/getCacheStore.js';

const RETRIEVAL_CACHE_TTL_MS = 5 * 60 * 1000;

/** 检索结果缓存包装 */
export const withRetrievalCache = async (
  query: KnowledgeRetrievalQuery,
  invoke: (q: KnowledgeRetrievalQuery) => Promise<KnowledgeRetrievalQueryResult>,
): Promise<KnowledgeRetrievalQueryResult> => {
  const enabled = (process.env.AI_RETRIEVAL_CACHE_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
  if (!enabled) {
    return invoke(query);
  }

  const topK = query.retrieval_mode === 'oneWay'
    ? query.single_retrieval_config.top_k
    : query.multiple_retrieval_config.top_k;

  const cacheKey = buildRetrievalCacheKey({
    query: query.query,
    datasetIds: query.dataset_ids,
    searchMethod: 'hybrid_search',
    topK,
  });

  const store = getCacheStore();
  const cached = await store.get(cacheKey);
  if (cached?.value) {
    return cached.value as KnowledgeRetrievalQueryResult;
  }

  const result = await invoke(query);
  await store.set(cacheKey, result, RETRIEVAL_CACHE_TTL_MS);
  return result;
};
