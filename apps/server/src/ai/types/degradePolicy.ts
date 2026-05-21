/** F-07: 高峰降级策略 */
export type DegradePolicy = {
  disableCoT: boolean;
  maxToolSteps: number;
  maxOutputTokens: number;
};

export const DEFAULT_DEGRADE_POLICY: DegradePolicy = {
  disableCoT: false,
  maxToolSteps: 8,
  maxOutputTokens: 4096,
};

export const PEAK_DEGRADE_POLICY: DegradePolicy = {
  disableCoT: true,
  maxToolSteps: 2,
  maxOutputTokens: 1024,
};
