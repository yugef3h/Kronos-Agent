import { env } from '../../core/config/env.js';
import type { GatewayModelConfig } from '../types/gatewayModelConfig.js';
import type { ModelProviderId } from '../types/modelProvider.js';
import type { ModelRouteIntent } from '../types/modelRouteIntent.js';

/** 与 env.ts superRefine 对齐：AI_PROVIDER 为空或 doubao → 走豆包；其余走通用 OpenAI 兼容 */
const resolveActiveProvider = (): {
  provider: ModelProviderId;
  model: string;
  baseUrl: string;
  apiKeyEnv: string;
} => {
  const raw = env.AI_PROVIDER?.trim().toLowerCase();
  if (!raw || raw === 'doubao') {
    return {
      provider: 'doubao',
      model: env.DOUBAO_MODEL!,
      baseUrl: env.DOUBAO_BASE_URL!,
      apiKeyEnv: 'DOUBAO_API_KEY',
    };
  }

  // deepseek / openai / 任意 OpenAI 兼容提供商
  const provider: ModelProviderId = raw === 'deepseek' ? 'deepseek' : 'openai';
  return {
    provider,
    model: env.AI_MODEL!,
    baseUrl: env.AI_BASE_URL!,
    apiKeyEnv: 'AI_API_KEY',
  };
};

/** 无网关配置（AI_GATEWAY_MODELS）时回退的默认模型；由 env superRefine 保证必填字段非空 */
export const resolveDefaultGatewayModel = (intent: ModelRouteIntent): GatewayModelConfig => {
  const active = resolveActiveProvider();

  if (active.provider !== 'doubao' || intent !== 'embedding' || !env.DOUBAO_EMBEDDING_MODEL?.trim()) {
    return {
      id: `${active.provider}-default`,
      provider: active.provider,
      model: active.model,
      baseUrl: active.baseUrl,
      apiKeyEnv: active.apiKeyEnv,
      intents: ['chat', 'embedding', 'vision', 'planning'],
      priority: 0,
      maxConcurrency: 8,
      enabled: true,
    };
  }

  // embedding 专用模型（仅 doubao 有独立 embedding 模型时）
  return {
    id: 'doubao-embedding-default',
    provider: 'doubao',
    model: env.DOUBAO_EMBEDDING_MODEL.trim(),
    baseUrl: env.DOUBAO_BASE_URL!,
    apiKeyEnv: 'DOUBAO_API_KEY',
    intents: ['embedding'],
    priority: 0,
    maxConcurrency: 8,
    enabled: true,
  };
};

/** 当前活跃模型名，供缓存键等场景使用 */
export const getActiveModelName = (): string => resolveActiveProvider().model;

/** 当前活跃模型的 API 凭据（baseUrl / model / apiKey），供直调 Doubao 兼容 API 的服务使用 */
export const getActiveModelCredentials = (): {
  model: string;
  baseUrl: string;
  apiKey: string;
} => {
  const active = resolveActiveProvider();
  return {
    model: active.model,
    baseUrl: active.baseUrl,
    apiKey: process.env[active.apiKeyEnv]?.trim() || '',
  };
};
