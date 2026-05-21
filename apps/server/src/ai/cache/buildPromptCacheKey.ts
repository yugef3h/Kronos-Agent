import { hashCacheKey } from './hashCacheKey.js';

/** C-04: Prompt 问答缓存键 */
export const buildPromptCacheKey = (
  prompt: string,
  model: string,
  temperature: number,
): string => hashCacheKey('prompt', {
  prompt: prompt.trim(),
  model,
  temperature,
});
