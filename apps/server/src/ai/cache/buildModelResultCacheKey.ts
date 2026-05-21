import { hashCacheKey } from './hashCacheKey.js';

/** P2-C-01: 模型固定回答缓存键 */
export const buildModelResultCacheKey = (
  prompt: string,
  model: string,
  logicKey = 'default',
): string => hashCacheKey('model_result', {
  prompt: prompt.trim(),
  model,
  logicKey,
});
