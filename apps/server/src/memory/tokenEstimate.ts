import { APPROX_TOKEN_PER_CHAR } from './constants.js';

export const estimateTextTokens = (text: string): number => {
  if (!text.trim()) {
    return 0;
  }

  return Math.max(1, Math.ceil(text.length * APPROX_TOKEN_PER_CHAR));
};
