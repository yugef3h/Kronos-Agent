import { createHash } from 'node:crypto';

/** 前缀片段类型 */
type PrefixSegment = { role: 'system' | 'user' | 'assistant'; content: string };

/** 前缀缓存条目 */
type PrefixCacheEntry = {
  prefixHash: string;
  prefixTokens: number;
  hitCount: number;
  createdAt: number;
  lastAccessedAt: number;
};

/** 前缀命中统计 */
type PrefixStats = {
  totalRequests: number;
  cacheHits: number;
  totalPrefixTokens: number;
  savedPrefixTokens: number;
};

/** 最大跟踪前缀数 */
const MAX_TRACKED_PREFIXES = 500;

/** 前缀缓存 Map：hash → entry */
const prefixCache = new Map<string, PrefixCacheEntry>();

/** 全局统计 */
const stats: PrefixStats = {
  totalRequests: 0,
  cacheHits: 0,
  totalPrefixTokens: 0,
  savedPrefixTokens: 0,
};

/** 是否为重复前缀记录最后访问时间 */
const touchPrefixCache = (hash: string): boolean => {
  const entry = prefixCache.get(hash);
  if (!entry) {
    return false;
  }

  entry.hitCount += 1;
  entry.lastAccessedAt = Date.now();
  return true;
};

/** 登记新前缀 */
const registerPrefix = (hash: string, tokenCount: number): void => {
  if (prefixCache.has(hash)) {
    return;
  }

  // LRU 淘汰：超过上限时删除最旧的条目
  if (prefixCache.size >= MAX_TRACKED_PREFIXES) {
    let oldestKey = '';
    let oldestTime = Infinity;

    for (const [key, entry] of prefixCache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      prefixCache.delete(oldestKey);
    }
  }

  const now = Date.now();
  prefixCache.set(hash, {
    prefixHash: hash,
    prefixTokens: tokenCount,
    hitCount: 0,
    createdAt: now,
    lastAccessedAt: now,
  });
};

/**
 * 计算前缀哈希。
 * 前缀 = system prompt + memory summary + 历史消息（不含最后一条用户消息）。
 */
export const computePrefixHash = (segments: PrefixSegment[]): string => {
  const normalized = segments
    .filter((s) => s.content.trim().length > 0)
    .map((s) => `${s.role}:${s.content.trim()}`)
    .join('\n');

  return createHash('sha256')
    .update(normalized)
    .digest('hex')
    .slice(0, 32);
};

/**
 * 检查前缀是否已缓存（命中则可用于 provider context caching）。
 * 返回前缀 token 数供调用方上报。
 */
export const checkPrefixCache = (
  segments: PrefixSegment[],
  estimatedTokens = 0,
): { prefixHash: string; cached: boolean; estimatedTokens: number } => {
  stats.totalRequests += 1;
  const prefixHash = computePrefixHash(segments);
  const cached = touchPrefixCache(prefixHash);

  if (cached) {
    stats.cacheHits += 1;
    const entry = prefixCache.get(prefixHash);
    stats.savedPrefixTokens += entry?.prefixTokens ?? estimatedTokens;
  } else {
    const tokenCount = estimatedTokens > 0 ? estimatedTokens : estimatePrefixTokens(segments);
    registerPrefix(prefixHash, tokenCount);
    stats.totalPrefixTokens += tokenCount;
  }

  return {
    prefixHash,
    cached,
    estimatedTokens: cached
      ? (prefixCache.get(prefixHash)?.prefixTokens ?? estimatedTokens)
      : estimatedTokens,
  };
};

/** 简单 token 估算（英文 4 chars/token，中文 1.5 chars/token） */
const estimatePrefixTokens = (segments: PrefixSegment[]): number => {
  let total = 0;
  for (const segment of segments) {
    const text = segment.content;
    const latinChars = (text.match(/[a-zA-Z0-9\s]/g) || []).length;
    const otherChars = text.length - latinChars;
    total += Math.ceil(latinChars / 4 + otherChars / 1.5);
  }
  return total;
};

/** 获取前缀缓存统计 */
export const getPrefixCacheStats = (): PrefixStats => ({ ...stats });

/** 前缀缓存命中率 */
export const getPrefixCacheHitRate = (): number => {
  if (stats.totalRequests === 0) {
    return 0;
  }
  return stats.cacheHits / stats.totalRequests;
};

/** 清空前缀缓存（测试用） */
export const clearPrefixCache = (): void => {
  prefixCache.clear();
  stats.totalRequests = 0;
  stats.cacheHits = 0;
  stats.totalPrefixTokens = 0;
  stats.savedPrefixTokens = 0;
};
