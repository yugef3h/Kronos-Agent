import { ChatOpenAI } from '@langchain/openai';
import type { GatewayModelConfig } from '../types/gatewayModelConfig.js';

export type OpenAiCompatibleClientOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

/** 由网关配置构造 OpenAI 兼容 Chat 客户端 */
export const buildOpenAiCompatibleClient = (
  config: GatewayModelConfig,
  options: OpenAiCompatibleClientOptions = {},
): ChatOpenAI => {
  const apiKey = process.env[config.apiKeyEnv]?.trim();
  if (!apiKey) {
    throw new Error(`Missing API key env: ${config.apiKeyEnv}`);
  }

  return new ChatOpenAI({
    model: config.model,
    apiKey,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    timeout: options.timeoutMs,
    configuration: {
      baseURL: config.baseUrl,
    },
  });
};
