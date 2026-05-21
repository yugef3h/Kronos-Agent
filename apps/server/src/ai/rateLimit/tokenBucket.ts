/** T-03: 内存令牌桶 */
export type TokenBucket = {
  key: string;
  capacity: number;
  tokens: number;
  refillPerSec: number;
  updatedAtMs: number;
};

export const createTokenBucket = (
  key: string,
  capacity: number,
  refillPerSec: number,
): TokenBucket => ({
  key,
  capacity,
  tokens: capacity,
  refillPerSec,
  updatedAtMs: Date.now(),
});

const refillTokens = (bucket: TokenBucket, nowMs: number): number => {
  const elapsedSec = Math.max(0, (nowMs - bucket.updatedAtMs) / 1000);
  const refilled = bucket.tokens + elapsedSec * bucket.refillPerSec;
  return Math.min(bucket.capacity, refilled);
};

/** T-04: 消费令牌；不足返回 false */
export const consumeTokenBucket = (bucket: TokenBucket, cost: number, nowMs = Date.now()): boolean => {
  const available = refillTokens(bucket, nowMs);
  if (available < cost) {
    bucket.tokens = available;
    bucket.updatedAtMs = nowMs;
    return false;
  }

  bucket.tokens = available - cost;
  bucket.updatedAtMs = nowMs;
  return true;
};

export const remainingTokens = (bucket: TokenBucket, nowMs = Date.now()): number =>
  Math.floor(refillTokens(bucket, nowMs));

export const retryAfterMsForBucket = (bucket: TokenBucket, cost: number, nowMs = Date.now()): number => {
  const available = refillTokens(bucket, nowMs);
  if (available >= cost) {
    return 0;
  }

  const deficit = cost - available;
  return Math.ceil((deficit / Math.max(bucket.refillPerSec, 0.001)) * 1000);
};
