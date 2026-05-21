import { appendAiTaskEvent } from './aiTaskEvents.js';
import { getAiTaskStore } from './getAiTaskStore.js';
import type { AiTaskRecord } from '../types/aiTaskRecord.js';
import { appendSessionMessages } from '../../domain/sessionStore.js';
import { streamPlaygroundAgentReply } from '../../services/agent/agentStreamRouter.js';
import type { Message } from '../../domain/sessionStore.js';

type ChatTaskPayload = {
  prompt?: string;
  sessionId?: string;
  sessionUserContent?: string;
  imageDataUrls?: string[];
  memorySummary?: string;
  history?: Message[];
  userId?: string;
};

const readPayload = (record: AiTaskRecord): ChatTaskPayload => {
  const raw = record.payload;
  return typeof raw === 'object' && raw != null ? raw as ChatTaskPayload : {};
};

/** 执行 chat 异步任务 */
export const runChatAiTask = async (taskId: string): Promise<void> => {
  const store = getAiTaskStore();
  const record = await store.get(taskId);
  if (!record || record.kind !== 'chat') {
    return;
  }

  const payload = readPayload(record);
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
  if (!prompt) {
    await store.patch(taskId, { status: 'failed', error: 'Missing prompt in task payload' });
    await appendAiTaskEvent(taskId, 'error', { message: 'Missing prompt' });
    return;
  }

  await store.patch(taskId, { status: 'running', progress: 5 });
  await appendAiTaskEvent(taskId, 'status', { status: 'running' });

  let assistantText = '';
  let progress = 10;

  try {
    const stream = streamPlaygroundAgentReply({
      prompt,
      history: Array.isArray(payload.history) ? payload.history : [],
      memorySummary: typeof payload.memorySummary === 'string' ? payload.memorySummary : '',
      sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : taskId,
      imageDataUrls: Array.isArray(payload.imageDataUrls) ? payload.imageDataUrls : undefined,
      userId: typeof payload.userId === 'string' ? payload.userId : 'anonymous',
    });

    for await (const event of stream) {
      if (event.type === 'content') {
        assistantText += event.content;
        progress = Math.min(95, progress + 2);
        await store.patch(taskId, { progress });
        await appendAiTaskEvent(taskId, 'content', { content: event.content, progress });
      } else if (event.type === 'timeline') {
        await appendAiTaskEvent(taskId, 'progress', {
          stage: event.stage,
          status: event.status,
          message: event.message,
        });
      }
    }

    await store.patch(taskId, {
      status: 'succeeded',
      progress: 100,
      result: { text: assistantText },
    });
    await appendAiTaskEvent(taskId, 'done', { text: assistantText });

    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
    if (sessionId && assistantText.trim().length > 0) {
      await appendSessionMessages({
        sessionId,
        messages: [{ role: 'assistant', content: assistantText }],
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'chat task failed';
    await store.patch(taskId, { status: 'failed', error: message });
    await appendAiTaskEvent(taskId, 'error', { message });
  }
};
