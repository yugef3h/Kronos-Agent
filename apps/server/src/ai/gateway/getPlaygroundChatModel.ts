import type { GatewayRequestContext } from '../types/gatewayRequestContext.js';
import { resolveGatewayChatModel, type GatewayChatModelOptions } from './resolveGatewayChatModel.js';

/** Playground 按请求上下文解析网关模型 */
export const getPlaygroundChatModel = (
  ctx: Partial<GatewayRequestContext> = {},
  options: GatewayChatModelOptions = {},
) => resolveGatewayChatModel(
  {
    userId: ctx.userId?.trim() || 'playground',
    sessionId: ctx.sessionId,
    intent: ctx.intent ?? 'chat',
    traceId: ctx.traceId?.trim() || `playground-${ctx.sessionId ?? 'default'}`,
  },
  options,
);
