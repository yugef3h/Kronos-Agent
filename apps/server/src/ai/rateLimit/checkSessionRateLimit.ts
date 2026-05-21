import type { RateLimitResult } from '../types/rateLimitResult.js';
import { consumeTokenBucket, retryAfterMsForBucket } from './tokenBucket.js';
import { getOrCreateBucket } from './rateLimitStore.js';

const DEFAULT_SESSION_CAPACITY = 30;
const DEFAULT_SESSION_REFILL_PER_SEC = 0.5;

/** T-06: 会话级请求限流 */
export const checkSessionRateLimit = (
  sessionId: string,
  cost = 1,
  nowMs = Date.now(),
): RateLimitResult => {
  const bucket = getOrCreateBucket('session', sessionId, DEFAULT_SESSION_CAPACITY, DEFAULT_SESSION_REFILL_PER_SEC);
  const allowed = consumeTokenBucket(bucket, cost, nowMs);

  return {
    allowed,
    scope: 'session',
    remaining: Math.max(0, Math.floor(bucket.tokens)),
    retryAfterMs: allowed ? 0 : retryAfterMsForBucket(bucket, cost, nowMs),
  };
};
