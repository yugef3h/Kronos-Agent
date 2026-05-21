import { getRedisClient } from '../../infra/redisClient.js';
import type { CacheStore } from './cacheStore.js';
import { memoryCacheStore } from './memoryCacheStore.js';
import { createRedisCacheStore } from './redisCacheStore.js';

let redisStore: CacheStore | undefined;

const isRedisCacheEnabled = (): boolean =>
  (process.env.AI_CACHE_REDIS ?? 'false').trim().toLowerCase() === 'true'
  || process.env.AI_CACHE_REDIS === '1';

/** C-08: 按 env 选择 memory 或 redis 缓存实现 */
export const getCacheStore = (): CacheStore => {
  if (!isRedisCacheEnabled()) {
    return memoryCacheStore;
  }

  if (!redisStore) {
    redisStore = createRedisCacheStore(getRedisClient().duplicate());
  }

  return redisStore;
};
