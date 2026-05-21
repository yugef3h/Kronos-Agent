import type { BaseMessage } from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import { recordCircuitFailure, recordCircuitSuccess } from '../circuit/circuitBreaker.js';
import { fallbackReplyText } from '../circuit/fallbackReplyText.js';
import { isCircuitOpen } from '../circuit/circuitBreaker.js';

/** P3-G-03: 流式推理并记录熔断状态 */
export const streamGatewayLlm = async (
  model: ChatOpenAI,
  messages: BaseMessage[],
) => {
  const circuitName = `model:${model.model}`;
  if (isCircuitOpen(circuitName)) {
    throw new Error(fallbackReplyText('circuit_open'));
  }

  try {
    const stream = await model.stream(messages);
    recordCircuitSuccess(circuitName);
    return stream;
  } catch (error) {
    recordCircuitFailure(circuitName);
    const message = error instanceof Error ? error.message : fallbackReplyText('model_unavailable');
    throw new Error(message);
  }
};
