import type { ModelProviderId } from './modelProvider.js';
import type { ModelRouteIntent } from './modelRouteIntent.js';

/** 单条网关模型配置 */
export type GatewayModelConfig = {
  id: string;
  provider: ModelProviderId;
  model: string;
  baseUrl: string;
  apiKeyEnv: string;
  intents: ModelRouteIntent[];
  priority: number;
  maxConcurrency: number;
  enabled: boolean;
};
