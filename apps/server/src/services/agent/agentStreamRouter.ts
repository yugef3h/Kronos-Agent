import type { Message } from '../../domain/sessionStore.js';
import { env } from '../../config/env.js';
import type { LangChainStreamEvent } from '../chat/streamEventTypes.js';
import { createTimelineEvent } from '../chat/timelineEvents.js';
import { streamLangGraphChatReply } from '../langgraph/langGraphChatStream.js';
import { streamLinearChatReply } from '../linear/linearChatStream.js';

export type AgentStreamParams = {
  prompt: string;
  history: Message[];
  memorySummary?: string;
  sessionId: string;
  imageDataUrls?: string[];
};

const toSafeErrorText = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, 180);
  }

  return 'unknown upstream error';
};

/** B 为主（LangGraph），失败则兜底 A（线性 plan-tool-reason）。 */
export async function* streamPlaygroundAgentReply(
  params: AgentStreamParams,
): AsyncGenerator<LangChainStreamEvent> {
  if (!env.LANGGRAPH_ENABLED) {
    yield* streamLinearChatReply({
      prompt: params.prompt,
      history: params.history,
      memorySummary: params.memorySummary,
      imageDataUrls: params.imageDataUrls,
    });
    return;
  }

  try {
    yield* streamLangGraphChatReply({
      prompt: params.prompt,
      history: params.history,
      memorySummary: params.memorySummary,
      sessionId: params.sessionId,
      imageDataUrls: params.imageDataUrls,
    });
  } catch (error) {
    const reason = toSafeErrorText(error);
    console.warn(
      `[streamPlaygroundAgentReply] LangGraph failed for session ${params.sessionId}, falling back to linear. reason: ${reason}`,
    );

    yield createTimelineEvent(
      'plan',
      'info',
      `LangGraph Agent 失败，已切换线性兜底路径。原因：${reason}`,
    );

    yield* streamLinearChatReply({
      prompt: params.prompt,
      history: params.history,
      memorySummary: params.memorySummary,
      imageDataUrls: params.imageDataUrls,
    });
  }
}
