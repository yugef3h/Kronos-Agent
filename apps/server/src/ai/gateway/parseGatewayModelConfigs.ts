import { z } from 'zod';
import type { GatewayModelConfig } from '../types/gatewayModelConfig.js';
import { isModelProviderId } from '../types/modelProvider.js';
import { isModelRouteIntent } from '../types/modelRouteIntent.js';

const gatewayModelConfigSchema = z.object({
  id: z.string().min(1),
  provider: z.string().refine(isModelProviderId, 'invalid provider'),
  model: z.string().min(1),
  baseUrl: z.string().url(),
  apiKeyEnv: z.string().min(1),
  intents: z.array(z.string().refine(isModelRouteIntent)).min(1),
  priority: z.number().int().default(0),
  maxConcurrency: z.number().int().positive().default(8),
  enabled: z.boolean().default(true),
});

const gatewayModelsSchema = z.array(gatewayModelConfigSchema);

/** 从 `AI_GATEWAY_MODELS` JSON 解析网关模型列表；空/非法返回 [] */
export const parseGatewayModelConfigs = (raw: string | undefined): GatewayModelConfig[] => {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const result = gatewayModelsSchema.safeParse(parsed);
    if (!result.success) {
      return [];
    }

    return result.data.map((item) => ({
      ...item,
      intents: [...item.intents],
    }));
  } catch {
    return [];
  }
};
