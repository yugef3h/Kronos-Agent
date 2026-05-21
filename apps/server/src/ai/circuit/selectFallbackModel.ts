import type { GatewayModelConfig } from '../types/gatewayModelConfig.js';
import type { GatewayRequestContext } from '../types/gatewayRequestContext.js';
import { isCircuitOpen } from './circuitBreaker.js';
import { selectGatewayModel } from '../gateway/selectGatewayModel.js';

/** 主模型熔断 open 时选择下一优先级备用 */
export const selectFallbackModel = (
  ctx: GatewayRequestContext,
  configs: GatewayModelConfig[],
  primary: GatewayModelConfig | null,
): GatewayModelConfig | null => {
  const primaryId = primary?.id;
  const candidates = configs
    .filter((config) => config.enabled && config.intents.includes(ctx.intent))
    .filter((config) => config.id !== primaryId)
    .filter((config) => !isCircuitOpen(`model:${config.id}`))
    .sort((left, right) => right.priority - left.priority);

  if (candidates.length > 0) {
    return candidates[0] ?? null;
  }

  if (primary && !isCircuitOpen(`model:${primary.id}`)) {
    return primary;
  }

  return selectGatewayModel(ctx, configs.filter((c) => !isCircuitOpen(`model:${c.id}`)));
};
