import { buildModelResultCacheKey } from '../ai/cache/buildModelResultCacheKey.js';
import { buildPromptCacheKey } from '../ai/cache/buildPromptCacheKey.js';
import { getCacheStore } from '../ai/cache/getCacheStore.js';
import { streamCachedPromptReply } from '../ai/cache/streamCachedPromptReply.js';
import { env } from '../config/env.js';
import { getSession, persistSession } from '../domain/sessionStore.js';
import { streamPlaygroundAgentReply } from './agent/agentStreamRouter.js';
import { createMemoryPlan } from '../memory/index.js';
import { recordTokenUsage } from '../ai/cost/tokenUsageStore.js';
import { estimateTextTokens } from '../memory/tokenEstimate.js';
import { streamMockReply } from './mockReplyService.js';

export async function* streamChat(params: {
  userId?: string;
  prompt: string;
  /** 落盘到 session 的用户消息正文；不传则使用 prompt。 */
  sessionUserContent?: string;
  sessionId: string;
  lastEventId: number;
  imageDataUrls?: string[];
}) {
  const { prompt, sessionUserContent, sessionId, lastEventId, imageDataUrls } = params;
  const session = getSession(sessionId);
  const userMessageTimestamp = Date.now();

  const persistedUserLine =
    typeof sessionUserContent === 'string' && sessionUserContent.trim().length > 0
      ? sessionUserContent.trim()
      : prompt;

  const userContent =
    imageDataUrls && imageDataUrls.length > 0
      ? `${persistedUserLine}\n[附图×${imageDataUrls.length}]`
      : persistedUserLine;

  session.messages.push({ role: 'user', content: userContent, timestamp: userMessageTimestamp });
  let assistantText = '';
  let eventId = 0;

  const memoryPlan = createMemoryPlan({
    prompt,
    messages: session.messages.slice(0, -1),
    memoryState: {
      summary: session.memorySummary,
      summaryUpdatedAt: session.memorySummaryUpdatedAt,
      summaryArchiveMessageCount: session.summaryArchiveMessageCount,
    },
  });

  session.memorySummary = memoryPlan.memorySummary;

  if (memoryPlan.summaryUpdated) {
    session.memorySummaryUpdatedAt = Date.now();
  }

  session.summaryArchiveMessageCount = memoryPlan.summaryArchiveMessageCount;

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

  const promptCacheKey = buildPromptCacheKey(prompt, env.DOUBAO_MODEL, 0.5);
  const promptCacheEntry = await getCacheStore().get(promptCacheKey);
  const cachedAnswer = typeof promptCacheEntry?.value === 'string' ? promptCacheEntry.value : null;

  if (cachedAnswer) {
    for (const chunk of streamCachedPromptReply(cachedAnswer, sessionId, lastEventId)) {
      yield chunk;
    }

    session.messages.push({ role: 'assistant', content: cachedAnswer, timestamp: Date.now() });
    session.lastId = eventId + 2;
    void persistSession(sessionId, session);
    return;
  }

  try {
    console.warn(`[playground-chat] streamChat agent pipeline start sessionId=${sessionId}`);
    const streamSource = streamPlaygroundAgentReply({
      prompt,
      history: memoryPlan.history,
      memorySummary: memoryPlan.memorySummary,
      sessionId,
      userId: params.userId,
      imageDataUrls,
    });

    for await (const event of streamSource) {
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
      message: `Playground 流式响应失败，已启用 Mock 降级回复。原因：${fallbackReason}`,
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

  session.messages.push({ role: 'assistant', content: assistantText, timestamp: Date.now() });

  if (assistantText.trim().length > 0) {
    await getCacheStore().set(promptCacheKey, assistantText, 60 * 60 * 1000);
    const modelResultKey = buildModelResultCacheKey(prompt, env.DOUBAO_MODEL, 'playground');
    await getCacheStore().set(modelResultKey, assistantText, 30 * 60 * 1000);
  }

  recordTokenUsage(params.userId ?? 'anonymous', {
    input: estimateTextTokens(`${prompt}\n${memoryPlan.memorySummary}`),
    output: estimateTextTokens(assistantText),
    model: env.DOUBAO_MODEL,
  });

  const finalizePlan = createMemoryPlan({
    prompt,
    messages: session.messages,
    memoryState: {
      summary: session.memorySummary,
      summaryUpdatedAt: session.memorySummaryUpdatedAt,
      summaryArchiveMessageCount: session.summaryArchiveMessageCount,
    },
  });

  session.memorySummary = finalizePlan.memorySummary;

  if (finalizePlan.summaryUpdated) {
    session.memorySummaryUpdatedAt = Date.now();
  }

  session.summaryArchiveMessageCount = finalizePlan.summaryArchiveMessageCount;

  const completeId = eventId + 1;
  session.lastId = completeId;

  // 须在 complete 之前落盘助手消息与滚动摘要，否则客户端收到 complete 后拉快照会读到空摘要
  yield `data: ${JSON.stringify({ type: 'complete', sessionId, eventId: completeId })}\nid: ${completeId}\n\n`;

  void persistSession(sessionId, session);
}
