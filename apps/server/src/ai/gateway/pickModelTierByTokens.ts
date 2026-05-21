import type { ModelRouteRule } from '../types/modelRouteRule.js';
import type { ModelTier } from '../types/modelTier.js';
import { estimatePromptTier } from './estimatePromptTier.js';

/** M-04: 规则表 + token 数 → 档位 */
export const pickModelTierByTokens = (
  tokenCount: number,
  rules: ModelRouteRule[],
): ModelTier => {
  const fallback = estimatePromptTier(tokenCount);
  const matched = rules
    .filter((rule) => tokenCount <= rule.maxPromptTokens)
    .sort((left, right) => left.maxPromptTokens - right.maxPromptTokens)[0];

  return matched?.tier ?? fallback;
};
