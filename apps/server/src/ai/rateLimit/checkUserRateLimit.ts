import type { RateLimitResult } from '../types/rateLimitResult.js';
import { consumeTokenBucket, retryAfterMsForBucket } from './tokenBucket.js';
import { getOrCreateBucket } from './rateLimitStore.js';

const DEFAULT_USER_CAPACITY = 60;
const DEFAULT_USER_REFILL_PER_SEC = 1;

/** T-05: 用户级请求限流（令牌桶） */
export const checkUserRateLimit = (
  userId: string,
  cost = 1,
  nowMs = Date.now(),
): RateLimitResult => {
  const bucket = getOrCreateBucket('user', userId, DEFAULT_USER_CAPACITY, DEFAULT_USER_REFILL_PER_SEC);
  const allowed = consumeTokenBucket(bucket, cost, nowMs);

  return {
    allowed,
    scope: 'user',
    remaining: Math.max(0, Math.floor(bucket.tokens)),
    retryAfterMs: allowed ? 0 : retryAfterMsForBucket(bucket, cost, nowMs),
  };
};
