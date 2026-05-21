import type { GatewayModelConfig } from '../types/gatewayModelConfig.js';
import type { GatewayRequestContext } from '../types/gatewayRequestContext.js';

/** G-06: 按 intent 与 priority 选择最高优先级且启用的模型 */
export const selectGatewayModel = (
  ctx: GatewayRequestContext,
  configs: GatewayModelConfig[],
): GatewayModelConfig | null => {
  const candidates = configs
    .filter((config) => config.enabled && config.intents.includes(ctx.intent))
    .sort((left, right) => right.priority - left.priority);

  return candidates[0] ?? null;
};
