/** 模型体量档位 */
export type ModelTier = 'small' | 'large' | 'local';

export const MODEL_TIERS: readonly ModelTier[] = ['small', 'large', 'local'] as const;
