/** C-01: 缓存分层 */
export type CacheLayer = 'prompt' | 'retrieval' | 'model_result';

export const CACHE_LAYERS: readonly CacheLayer[] = [
  'prompt',
  'retrieval',
  'model_result',
] as const;
