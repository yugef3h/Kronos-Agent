import type { ModelTier } from '../types/modelTier.js';

const SMALL_TOKEN_MAX = 500;
const LARGE_TOKEN_MAX = 4000;

/** 按 prompt token 数估算模型档位 */
export const estimatePromptTier = (tokenCount: number): ModelTier => {
  if (tokenCount <= SMALL_TOKEN_MAX) {
    return 'small';
  }

  if (tokenCount <= LARGE_TOKEN_MAX) {
    return 'large';
  }

  return 'large';
};
