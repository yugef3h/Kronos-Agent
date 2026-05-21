/** 通用缓存条目 */
export type CacheEntry<T> = {
  key: string;
  value: T;
  expiresAt: number;
  hitCount: number;
};
