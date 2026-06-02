import type { BaseMessage } from '@langchain/core/messages';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { ChatOpenAI } from '@langchain/openai';
import { recordCircuitFailure, recordCircuitSuccess } from '../circuit/circuitBreaker.js';
import { fallbackReplyText } from '../circuit/fallbackReplyText.js';
import { isCircuitOpen } from '../circuit/circuitBreaker.js';

export type StreamGatewayOptions = {
  callbacks?: BaseCallbackHandler[];
};

/** 流式推理并记录熔断状态 */
export const streamGatewayLlm = async (
  model: ChatOpenAI,
  messages: BaseMessage[],
  options: StreamGatewayOptions = {},
) => {
  const circuitName = `model:${model.model}`;
  if (isCircuitOpen(circuitName)) {
    throw new Error(fallbackReplyText('circuit_open'));
  }

  try {
    const stream = await model.stream(messages, { callbacks: options.callbacks });
    recordCircuitSuccess(circuitName);
    return stream;
  } catch (error) {
    recordCircuitFailure(circuitName);
    const message = error instanceof Error ? error.message : fallbackReplyText('model_unavailable');
    throw new Error(message);
  }
};
