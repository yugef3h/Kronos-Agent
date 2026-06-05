import { buildModelResultCacheKey } from '../../ai/cache/buildModelResultCacheKey.js';
import { buildPromptCacheKey } from '../../ai/cache/buildPromptCacheKey.js';
import { getCacheStore } from '../../ai/cache/getCacheStore.js';
import { querySemanticCache, writeSemanticCache } from '../../ai/cache/semanticCacheStore.js';
import { streamCachedPromptReply } from '../../ai/cache/streamCachedPromptReply.js';
import {
  loadSession,
  persistSession,
  SessionConflictError,
  waitForSessionPersist,
} from '../../models/sessionStore.js';
import { acquireSessionStreamLock } from '../../models/session/sessionStreamLock.js';
import { streamPlaygroundAgentReply } from '../agent/agentStreamRouter.js';
import { createMemoryPlan } from '../../memory/index.js';
import { getActiveModelName } from '../../ai/gateway/resolveDefaultGatewayModel.js';
import { recordTokenUsage } from '../../ai/cost/tokenUsageStore.js';
import { estimateTextTokens } from '../../memory/tokenEstimate.js';
import { streamMockReply } from './mockReplyService.js';
import { checkInputGuardrail } from '../guardrail/index.js';

const waitForSessionPersistSafe = async (sessionId: string): Promise<string | null> => {
  try {
    await waitForSessionPersist(sessionId);
    return null;
  } catch (error) {
    if (error instanceof SessionConflictError) {
      return `会话版本冲突（${sessionId}），请刷新后重试。`;
    }

    const reason = error instanceof Error ? error.message : 'unknown error';
    return `会话落盘失败：${reason}`;
  }
};

async function* streamChatBody(params: {
  userId?: string;
  prompt: string;
  sessionUserContent?: string;
  sessionId: string;
  lastEventId: number;
  imageDataUrls?: string[];
}): AsyncGenerator<string> {
  const { prompt, sessionUserContent, sessionId, lastEventId, imageDataUrls } = params;
  let session = await loadSession(sessionId);
  const inputGuardrail = checkInputGuardrail(prompt);

  if (inputGuardrail.blocked) {
    const refusal = '抱歉，该请求未通过安全校验，请修改后重试。';
    let blockedEventId = 0;

    blockedEventId += 1;
    if (blockedEventId > lastEventId) {
      yield `data: ${JSON.stringify({
        type: 'timeline',
        stage: 'plan',
        status: 'info',
        message: `Guardrail 拦截：${inputGuardrail.reason}`,
        sessionId,
        eventId: blockedEventId,
        timestamp: Date.now(),
      })}\nid: ${blockedEventId}\n\n`;
    }

    blockedEventId += 1;
    if (blockedEventId > lastEventId) {
      yield `data: ${JSON.stringify({
        type: 'content',
        content: refusal,
        sessionId,
        eventId: blockedEventId,
      })}\nid: ${blockedEventId}\n\n`;
    }

    const completeId = blockedEventId + 1;
    session.messages.push({ role: 'user', content: prompt, timestamp: Date.now() });
    session.messages.push({ role: 'assistant', content: refusal, timestamp: Date.now() });
    session.lastId = completeId;
    persistSession(sessionId, session);
    await waitForSessionPersistSafe(sessionId);
    yield `data: ${JSON.stringify({ type: 'complete', sessionId, eventId: completeId })}\nid: ${completeId}\n\n`;
    return;
  }

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
  persistSession(sessionId, session);
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

  // L1 语义缓存：嵌入余弦相似度匹配
  const semanticAnswer = await querySemanticCache(prompt);
  if (semanticAnswer) {
    for (const chunk of streamCachedPromptReply(semanticAnswer, sessionId, lastEventId)) {
      yield chunk;
    }

    session.messages.push({ role: 'assistant', content: semanticAnswer, timestamp: Date.now() });
    session.lastId = eventId + 2;
    persistSession(sessionId, session);
    const semanticPersistIssue = await waitForSessionPersistSafe(sessionId);
    if (semanticPersistIssue) {
      console.warn(`[streamChat] ${semanticPersistIssue}`);
    }
    return;
  }

  const modelResultKey = buildModelResultCacheKey(prompt, getActiveModelName(), 'playground');
  const modelResultEntry = await getCacheStore().get(modelResultKey);
  const modelResultAnswer = typeof modelResultEntry?.value === 'string' ? modelResultEntry.value : null;

  if (modelResultAnswer) {
    for (const chunk of streamCachedPromptReply(modelResultAnswer, sessionId, lastEventId)) {
      yield chunk;
    }

    session.messages.push({ role: 'assistant', content: modelResultAnswer, timestamp: Date.now() });
    session.lastId = eventId + 2;
    persistSession(sessionId, session);
    const cachePersistIssue = await waitForSessionPersistSafe(sessionId);
    if (cachePersistIssue) {
      console.warn(`[streamChat] ${cachePersistIssue}`);
    }
    return;
  }

  const promptCacheKey = buildPromptCacheKey(prompt, getActiveModelName(), 0.5);
  const promptCacheEntry = await getCacheStore().get(promptCacheKey);
  const cachedAnswer = typeof promptCacheEntry?.value === 'string' ? promptCacheEntry.value : null;

  if (cachedAnswer) {
    for (const chunk of streamCachedPromptReply(cachedAnswer, sessionId, lastEventId)) {
      yield chunk;
    }

    session.messages.push({ role: 'assistant', content: cachedAnswer, timestamp: Date.now() });
    session.lastId = eventId + 2;
    persistSession(sessionId, session);
    const promptPersistIssue = await waitForSessionPersistSafe(sessionId);
    if (promptPersistIssue) {
      console.warn(`[streamChat] ${promptPersistIssue}`);
    }
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
    await getCacheStore().set(modelResultKey, assistantText, 30 * 60 * 1000);
    void writeSemanticCache(prompt, assistantText).catch((error) => {
      console.warn(`[streamChat] writeSemanticCache failed: ${error instanceof Error ? error.message : 'unknown'}`);
    });
  }

  recordTokenUsage(params.userId ?? 'anonymous', {
    input: estimateTextTokens(`${prompt}\n${memoryPlan.memorySummary}`),
    output: estimateTextTokens(assistantText),
    model: getActiveModelName(),
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

  persistSession(sessionId, session);
  const persistIssue = await waitForSessionPersistSafe(sessionId);

  if (persistIssue) {
    eventId += 1;
    if (eventId > lastEventId) {
      yield `data: ${JSON.stringify({
        type: 'timeline',
        stage: 'plan',
        status: 'info',
        message: persistIssue,
        sessionId,
        eventId,
        timestamp: Date.now(),
      })}\nid: ${eventId}\n\n`;
    }
  }

  yield `data: ${JSON.stringify({ type: 'complete', sessionId, eventId: completeId })}\nid: ${completeId}\n\n`;
}

export async function* streamChat(params: {
  userId?: string;
  prompt: string;
  sessionUserContent?: string;
  sessionId: string;
  lastEventId: number;
  imageDataUrls?: string[];
}): AsyncGenerator<string> {
  const releaseLock = await acquireSessionStreamLock(params.sessionId);

  try {
    yield* streamChatBody(params);
  } finally {
    if (releaseLock) {
      await releaseLock();
    }
  }
}
