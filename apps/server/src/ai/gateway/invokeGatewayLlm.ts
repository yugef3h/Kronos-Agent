import type { AIMessageChunk } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { recordCircuitFailure, recordCircuitSuccess } from '../circuit/circuitBreaker.js';
import { invokeWithRetry } from '../circuit/invokeWithRetry.js';
import { fallbackReplyText } from '../circuit/fallbackReplyText.js';
import { isCircuitOpen } from '../circuit/circuitBreaker.js';

export type GatewayInvokeOptions = {
  maxAttempts?: number;
  backoffMs?: number;
  /** bindTools 后的 Runnable 无 `.model` 时由调用方传入 */
  modelName?: string;
  /** LangFuse 等可观测性回调 */
  callbacks?: BaseCallbackHandler[];
};

type GatewayInvokableModel = {
  model?: string;
  invoke: (messages: BaseMessage[], options?: { callbacks?: BaseCallbackHandler[] }) => Promise<AIMessageChunk>;
};

/** 对 ChatOpenAI（或 bindTools 后的 Runnable）做熔断 + 重试 invoke */
export const invokeGatewayLlm = async (
  model: GatewayInvokableModel,
  messages: BaseMessage[],
  options: GatewayInvokeOptions = {},
) => {
  const circuitName = `model:${options.modelName ?? model.model ?? 'unknown'}`;
  if (isCircuitOpen(circuitName)) {
    throw new Error(fallbackReplyText('circuit_open'));
  }

  try {
    const response = await invokeWithRetry(
      () => model.invoke(messages, { callbacks: options.callbacks }),
      { maxAttempts: options.maxAttempts ?? 2, backoffMs: options.backoffMs ?? 400 },
    );
    recordCircuitSuccess(circuitName);
    return response;
  } catch (error) {
    recordCircuitFailure(circuitName);
    const message = error instanceof Error ? error.message : fallbackReplyText('model_unavailable');
    throw new Error(message);
  }
};
