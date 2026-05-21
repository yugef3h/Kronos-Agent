import type { GatewayRequestContext } from '../types/gatewayRequestContext.js';

/** Playground 网关上下文工厂 */
export const buildPlaygroundGatewayContext = (params: {
  userId?: string;
  sessionId?: string;
  suffix?: string;
}): GatewayRequestContext => ({
  userId: params.userId?.trim() || 'playground',
  sessionId: params.sessionId,
  intent: 'chat',
  traceId: `${params.sessionId ?? 'session'}-${params.suffix ?? 'chat'}-${Date.now()}`,
});
