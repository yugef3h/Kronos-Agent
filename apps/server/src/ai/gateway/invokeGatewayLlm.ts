import type { BaseMessage } from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import { recordCircuitFailure, recordCircuitSuccess } from '../circuit/circuitBreaker.js';
import { invokeWithRetry } from '../circuit/invokeWithRetry.js';
import { fallbackReplyText } from '../circuit/fallbackReplyText.js';
import { isCircuitOpen } from '../circuit/circuitBreaker.js';

export type GatewayInvokeOptions = {
  maxAttempts?: number;
  backoffMs?: number;
};

/** P3-G-02: 对已有 ChatOpenAI 实例做熔断 + 重试 invoke */
export const invokeGatewayLlm = async (
  model: ChatOpenAI,
  messages: BaseMessage[],
  options: GatewayInvokeOptions = {},
) => {
  const circuitName = `model:${model.model}`;
  if (isCircuitOpen(circuitName)) {
    throw new Error(fallbackReplyText('circuit_open'));
  }

  try {
    const response = await invokeWithRetry(
      () => model.invoke(messages),
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
