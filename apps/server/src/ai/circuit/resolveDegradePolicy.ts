import type { DegradePolicy } from '../types/degradePolicy.js';
import { DEFAULT_DEGRADE_POLICY, PEAK_DEGRADE_POLICY } from '../types/degradePolicy.js';

/** 按负载百分比选择降级策略 */
export const resolveDegradePolicy = (loadPercent: number): DegradePolicy => {
  if (loadPercent >= 85) {
    return PEAK_DEGRADE_POLICY;
  }

  if (loadPercent >= 70) {
    return {
      ...DEFAULT_DEGRADE_POLICY,
      maxToolSteps: 4,
      maxOutputTokens: 2048,
    };
  }

  return DEFAULT_DEGRADE_POLICY;
};
