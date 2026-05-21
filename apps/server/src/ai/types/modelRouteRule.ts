import type { ModelRouteIntent } from './modelRouteIntent.js';
import type { ModelTier } from './modelTier.js';

/** M-02: 按 token 体量分流规则 */
export type ModelRouteRule = {
  intent: ModelRouteIntent;
  tier: ModelTier;
  maxPromptTokens: number;
};
