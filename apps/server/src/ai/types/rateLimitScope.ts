/** 分层限流作用域 */
export type RateLimitScope =
  | 'user'
  | 'session'
  | 'token_budget'
  | 'concurrent_session'
  | 'public_asset_ip';

export const RATE_LIMIT_SCOPES: readonly RateLimitScope[] = [
  'user',
  'session',
  'token_budget',
  'concurrent_session',
  'public_asset_ip',
] as const;
