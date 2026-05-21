import type { CacheEntry } from '../types/cacheEntry.js';

/** 缓存读写接口（memory / redis 共用） */
export type CacheStore<T = unknown> = {
  get: (key: string) => Promise<CacheEntry<T> | null>;
  set: (key: string, value: T, ttlMs: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
};
