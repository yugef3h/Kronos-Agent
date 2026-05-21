import type { ModelRouteIntent } from './modelRouteIntent.js';

/** 单次 AI 请求的网关上下文 */
export type GatewayRequestContext = {
  userId: string;
  sessionId?: string;
  intent: ModelRouteIntent;
  traceId: string;
};
