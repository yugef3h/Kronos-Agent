import { createHash } from 'node:crypto';
import type { CacheLayer } from '../types/cacheLayer.js';

/** C-03: 稳定缓存键（layer + 有序 parts） */
export const hashCacheKey = (layer: CacheLayer, parts: Record<string, string | number | boolean>): string => {
  const normalized = Object.keys(parts)
    .sort()
    .map((key) => `${key}=${String(parts[key])}`)
    .join('&');

  const digest = createHash('sha256')
    .update(`${layer}:${normalized}`)
    .digest('hex');

  return `${layer}:${digest.slice(0, 32)}`;
};
