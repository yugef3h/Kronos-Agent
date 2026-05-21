import type { GatewayRequestContext } from '../types/gatewayRequestContext.js';

/** G-09: 向上游模型透传 trace / user 元数据 */
export const createGatewayInvokeHeaders = (
  ctx: GatewayRequestContext,
): Record<string, string> => ({
  'x-kronos-trace-id': ctx.traceId,
  'x-kronos-user-id': ctx.userId,
  ...(ctx.sessionId ? { 'x-kronos-session-id': ctx.sessionId } : {}),
});
