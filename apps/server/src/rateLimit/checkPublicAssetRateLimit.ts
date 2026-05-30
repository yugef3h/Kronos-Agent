import type { RateLimitResult } from '../ai/types/rateLimitResult.js';
import { getOrCreateBucket } from '../ai/rateLimit/rateLimitStore.js';
import { consumeTokenBucket, retryAfterMsForBucket } from '../ai/rateLimit/tokenBucket.js';

/** demo：GET ~60/min；PUT ~10/min */
const GET_CAPACITY = 60;
const GET_REFILL_PER_SEC = 1;
const PUT_CAPACITY = 10;
const PUT_REFILL_PER_SEC = 0.17;

export const checkPublicAssetRateLimit = (
  clientKey: string,
  isWrite: boolean,
  nowMs = Date.now(),
): RateLimitResult => {
  const capacity = isWrite ? PUT_CAPACITY : GET_CAPACITY;
  const refillPerSec = isWrite ? PUT_REFILL_PER_SEC : GET_REFILL_PER_SEC;
  const bucket = getOrCreateBucket('public_asset_ip', clientKey, capacity, refillPerSec);
  const allowed = consumeTokenBucket(bucket, 1, nowMs);

  return {
    allowed,
    scope: 'public_asset_ip',
    remaining: Math.max(0, Math.floor(bucket.tokens)),
    retryAfterMs: allowed ? 0 : retryAfterMsForBucket(bucket, 1, nowMs),
  };
};
