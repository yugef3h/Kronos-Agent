import { getSession } from '../domain/sessionStore.js';
import { streamLangChainReply } from './langchainChatService.js';
import { createMemoryPlan } from './memoryOrchestrator.js';
import { streamMockReply } from './mockReplyService.js';

export async function* streamChat(params: {
  prompt: string;
  sessionId: string;
  lastEventId: number;
}) {
  const { prompt, sessionId, lastEventId } = params;
  const session = getSession(sessionId);

  session.messages.push({ role: 'user', content: prompt });
  let assistantText = '';
  let eventId = 0;

  const memoryPlan = createMemoryPlan({
    prompt,
    messages: session.messages.slice(0, -1),
    memoryState: {
      summary: session.memorySummary,
      summaryUpdatedAt: session.memorySummaryUpdatedAt,
    },
  });

  session.memorySummary = memoryPlan.memorySummary;

  if (memoryPlan.summaryUpdated) {
    session.memorySummaryUpdatedAt = Date.now();
  }

  eventId += 1;
  if (eventId > lastEventId) {
    yield `data: ${JSON.stringify({
      type: 'timeline',
      stage: 'plan',
      status: 'info',
      message: `记忆编排完成：history≈${memoryPlan.diagnostics.historyTokensEstimate} tokens，summary≈${memoryPlan.diagnostics.summaryTokensEstimate} tokens，输入预算≈${memoryPlan.diagnostics.budgetTokensEstimate} tokens。`,
      sessionId,
      eventId,
      timestamp: Date.now(),
    })}\nid: ${eventId}\n\n`;
  }

  try {
    for await (const event of streamLangChainReply({
      prompt,
      history: memoryPlan.history,
      memorySummary: memoryPlan.memorySummary,
    })) {
      eventId += 1;

      if (eventId <= lastEventId) {
        continue;
      }

      if (event.type === 'timeline') {
        yield `data: ${JSON.stringify({
          type: 'timeline',
          stage: event.stage,
          status: event.status,
          message: event.message,
          toolName: event.toolName,
          toolInput: event.toolInput,
          toolOutput: event.toolOutput,
          toolError: event.toolError,
          timestamp: event.timestamp,
          sessionId,
          eventId,
        })}\nid: ${eventId}\n\n`;

        continue;
      }

      assistantText += event.content;

      yield `data: ${JSON.stringify({
        type: 'content',
        content: event.content,
        sessionId,
        eventId,
      })}\nid: ${eventId}\n\n`;
    }
  } catch (error) {
    assistantText = '';

    const fallbackReason =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.slice(0, 180)
        : 'unknown upstream error';

    console.warn(
      `[streamChat] LangChain fallback enabled for session ${sessionId}. reason: ${fallbackReason}`,
    );

    eventId += 1;
    yield `data: ${JSON.stringify({
      type: 'timeline',
      stage: 'reason',
      status: 'info',
      message: `LangChain 流式响应失败，已启用 Mock 降级回复。原因：${fallbackReason}`,
      sessionId,
      eventId,
      timestamp: Date.now(),
    })}\nid: ${eventId}\n\n`;

    for await (const token of streamMockReply(prompt)) {
      eventId += 1;
      assistantText += token;

      if (eventId <= lastEventId) {
        continue;
      }

      yield `data: ${JSON.stringify({
        type: 'content',
        content: token,
        sessionId,
        eventId,
      })}\nid: ${eventId}\n\n`;
    }
  }

  const completeId = eventId + 1;
  yield `data: ${JSON.stringify({ type: 'complete', sessionId, eventId: completeId })}\nid: ${completeId}\n\n`;

  session.messages.push({ role: 'assistant', content: assistantText });
  session.lastId = completeId;
}
