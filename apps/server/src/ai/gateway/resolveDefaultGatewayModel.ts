import { env } from '../../config/env.js';
import type { GatewayModelConfig } from '../types/gatewayModelConfig.js';
import type { ModelRouteIntent } from '../types/modelRouteIntent.js';

const defaultApiKeyEnv = 'DOUBAO_API_KEY';

/** 无网关配置时回退豆包默认模型 */
export const resolveDefaultGatewayModel = (intent: ModelRouteIntent): GatewayModelConfig => {
  const model = intent === 'embedding' && env.DOUBAO_EMBEDDING_MODEL?.trim()
    ? env.DOUBAO_EMBEDDING_MODEL.trim()
    : env.DOUBAO_MODEL;

  return {
    id: 'doubao-default',
    provider: 'doubao',
    model,
    baseUrl: env.DOUBAO_BASE_URL,
    apiKeyEnv: defaultApiKeyEnv,
    intents: ['chat', 'embedding', 'vision', 'planning'],
    priority: 0,
    maxConcurrency: 8,
    enabled: true,
  };
};
