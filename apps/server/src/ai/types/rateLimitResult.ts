import type { RateLimitScope } from './rateLimitScope.js';

/** 限流检查结果 */
export type RateLimitResult = {
  allowed: boolean;
  scope: RateLimitScope;
  remaining: number;
  retryAfterMs: number;
};
