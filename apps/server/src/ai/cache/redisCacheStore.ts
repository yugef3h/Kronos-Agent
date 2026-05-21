import type Redis from 'ioredis';
import type { CacheStore } from './cacheStore.js';

const CACHE_KEY_PREFIX = 'kronos:ai:cache:';

const toRedisKey = (key: string): string => `${CACHE_KEY_PREFIX}${key}`;

type StoredPayload = {
  value: unknown;
  hitCount: number;
};

/** C-07: Redis TTL 缓存（需 REDIS_URL） */
export const createRedisCacheStore = (redis: Redis): CacheStore => ({
  async get(key) {
    const raw = await redis.get(toRedisKey(key));
    if (!raw) {
      return null;
    }

    let payload: StoredPayload;
    try {
      payload = JSON.parse(raw) as StoredPayload;
    } catch {
      await redis.del(toRedisKey(key));
      return null;
    }

    const ttlMs = await redis.pttl(toRedisKey(key));
    if (ttlMs <= 0) {
      return null;
    }

    await redis.set(
      toRedisKey(key),
      JSON.stringify({ value: payload.value, hitCount: payload.hitCount + 1 }),
      'PX',
      ttlMs,
    );

    return {
      key,
      value: payload.value,
      expiresAt: Date.now() + ttlMs,
      hitCount: payload.hitCount + 1,
    };
  },

  async set(key, value, ttlMs) {
    const payload: StoredPayload = { value, hitCount: 0 };
    await redis.set(toRedisKey(key), JSON.stringify(payload), 'PX', Math.max(ttlMs, 1));
  },

  async delete(key) {
    await redis.del(toRedisKey(key));
  },
});
