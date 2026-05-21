import type { GatewayRequestContext } from '../types/gatewayRequestContext.js';
import { recordCircuitFailure, recordCircuitSuccess } from '../circuit/circuitBreaker.js';
import { invokeWithRetry } from '../circuit/invokeWithRetry.js';
import { fallbackReplyText } from '../circuit/fallbackReplyText.js';
import type { GatewayChatModelOptions } from './resolveGatewayChatModel.js';
import { resolveGatewayChatModel } from './resolveGatewayChatModel.js';

/** 网关调用包裹重试 + 熔断记账 */
export const invokeGatewayChat = async (
  ctx: GatewayRequestContext,
  messages: Parameters<ReturnType<typeof resolveGatewayChatModel>['invoke']>[0],
  options: GatewayChatModelOptions & { modelId?: string; maxAttempts?: number } = {},
) => {
  const model = resolveGatewayChatModel(ctx, options);
  const circuitName = `model:${options.modelId ?? model.model}`;

  try {
    const response = await invokeWithRetry(
      () => model.invoke(messages),
      { maxAttempts: options.maxAttempts ?? 2, backoffMs: 400 },
    );
    recordCircuitSuccess(circuitName);
    return response;
  } catch (error) {
    recordCircuitFailure(circuitName);
    const message = error instanceof Error ? error.message : fallbackReplyText('model_unavailable');
    throw new Error(message);
  }
};
