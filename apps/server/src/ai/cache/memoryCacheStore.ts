import type { CacheEntry } from '../types/cacheEntry.js';
import type { CacheStore } from './cacheStore.js';

const entries = new Map<string, CacheEntry<unknown>>();

const isExpired = (entry: CacheEntry<unknown>, nowMs: number): boolean => entry.expiresAt <= nowMs;

/** 进程内 TTL 缓存 */
export const memoryCacheStore: CacheStore = {
  async get(key) {
    const entry = entries.get(key);
    if (!entry) {
      return null;
    }

    if (isExpired(entry, Date.now())) {
      entries.delete(key);
      return null;
    }

    entry.hitCount += 1;
    return entry;
  },

  async set(key, value, ttlMs) {
    entries.set(key, {
      key,
      value,
      expiresAt: Date.now() + Math.max(ttlMs, 0),
      hitCount: 0,
    });
  },

  async delete(key) {
    entries.delete(key);
  },
};

export const clearMemoryCacheStore = (): void => {
  entries.clear();
};

export const listMemoryCacheKeys = (): string[] => [...entries.keys()];
