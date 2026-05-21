import type { GatewayModelConfig } from '../types/gatewayModelConfig.js';
import type { ModelTier } from '../types/modelTier.js';

const tierProviderMap: Record<ModelTier, GatewayModelConfig['provider'][]> = {
  small: ['doubao', 'qwen', 'local'],
  large: ['doubao', 'openai', 'wenxin', 'spark'],
  local: ['local'],
};

/** 按档位过滤网关模型配置 */
export const filterConfigsByTier = (
  configs: GatewayModelConfig[],
  tier: ModelTier,
): GatewayModelConfig[] => {
  const providers = new Set(tierProviderMap[tier]);
  return configs.filter((config) => providers.has(config.provider));
};
