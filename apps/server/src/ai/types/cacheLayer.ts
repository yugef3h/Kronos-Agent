/** 缓存分层 */
export type CacheLayer =
  | 'prompt'
  | 'retrieval'
  | 'model_result'
  | 'agent_plan'
  | 'agent_tool'
  | 'agent_reason';

export const CACHE_LAYERS: readonly CacheLayer[] = [
  'prompt',
  'retrieval',
  'model_result',
  'agent_plan',
  'agent_tool',
  'agent_reason',
] as const;
