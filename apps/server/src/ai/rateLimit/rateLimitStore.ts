import type { RateLimitScope } from '../types/rateLimitScope.js';
import { createTokenBucket, type TokenBucket } from './tokenBucket.js';

const buckets = new Map<string, TokenBucket>();

const bucketKey = (scope: RateLimitScope, id: string) => `${scope}:${id}`;

export const getOrCreateBucket = (
  scope: RateLimitScope,
  id: string,
  capacity: number,
  refillPerSec: number,
): TokenBucket => {
  const key = bucketKey(scope, id);
  const existing = buckets.get(key);
  if (existing) {
    return existing;
  }

  const created = createTokenBucket(key, capacity, refillPerSec);
  buckets.set(key, created);
  return created;
};

export const clearRateLimitStore = (): void => {
  buckets.clear();
};
