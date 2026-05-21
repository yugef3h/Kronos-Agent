import { fetchEventSource } from '@microsoft/fetch-event-source';

import { apiUrl } from '../../../lib/api';
import type { AiTaskSseEvent, ChatAsyncAccepted } from '../../../types/chatAsyncTask';
import type { StreamChunk, TimelineEvent } from '../../../types/chat';

export type AiTaskStreamHandlers = {
  onContent: (content: string) => void;
  onTimeline: (event: Omit<TimelineEvent, 'eventId'> & { eventId: number }) => void;
  onComplete: () => void;
  onError: (message: string) => void;
  shouldContinue: () => boolean;
};

const readString = (data: Record<string, unknown>, key: string): string | undefined => {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
};

/** P4-W-03: 将任务 SSE 事件映射为 Playground 流式回调 */
export const mapAiTaskEventToHandlers = (
  event: AiTaskSseEvent,
  handlers: AiTaskStreamHandlers,
): void => {
  if (!handlers.shouldContinue()) {
    return;
  }

  if (event.type === 'content') {
    const content = readString(event.data, 'content');
    if (content) {
      handlers.onContent(content);
    }
    return;
  }

  if (event.type === 'progress') {
    const stage = readString(event.data, 'stage');
    const status = readString(event.data, 'status');
    const message = readString(event.data, 'message');
    if (stage && status && message) {
      handlers.onTimeline({
        eventId: event.id,
        stage: stage as TimelineEvent['stage'],
        status: status as TimelineEvent['status'],
        message,
        timestamp: event.timestamp,
      });
    }
    return;
  }

  if (event.type === 'done') {
    handlers.onComplete();
    return;
  }

  if (event.type === 'error') {
    handlers.onError(readString(event.data, 'message') ?? '异步任务失败');
  }
};

/** P4-W-03: 消费 /api/ai/tasks/:id/events */
export const consumeAiTaskEventsSse = async (params: {
  accepted: ChatAsyncAccepted;
  authToken: string;
  signal: AbortSignal;
  handlers: AiTaskStreamHandlers;
}): Promise<boolean> => {
  let completed = false;

  await fetchEventSource(apiUrl(params.accepted.eventsUrl), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.authToken}`,
    },
    signal: params.signal,
    onmessage(message) {
      if (!params.handlers.shouldContinue()) {
        return;
      }

      const event = JSON.parse(message.data) as AiTaskSseEvent;
      mapAiTaskEventToHandlers(event, params.handlers);
      if (event.type === 'done') {
        completed = true;
      }
    },
    onerror(error) {
      throw error;
    },
  });

  return completed;
};

const parseSseDataLines = (buffer: string): { events: StreamChunk[]; rest: string } => {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: StreamChunk[] = [];

  for (const part of parts) {
    const dataLine = part
      .split('\n')
      .find((line) => line.startsWith('data: '));

    if (!dataLine) {
      continue;
    }

    try {
      events.push(JSON.parse(dataLine.slice(6)) as StreamChunk);
    } catch {
      // skip invalid chunk
    }
  }

  return { events, rest };
};

/** P4-W-03: 首轮 fetch 返回 200 SSE 时解析响应体 */
export const consumeChatStreamSseResponse = async (params: {
  response: Response;
  handlers: {
    onChunk: (chunk: StreamChunk) => void;
    shouldContinue: () => boolean;
  };
}): Promise<void> => {
  const reader = params.response.body?.getReader();
  if (!reader) {
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (params.handlers.shouldContinue()) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseDataLines(buffer);
    buffer = rest;

    for (const chunk of events) {
      if (!params.handlers.shouldContinue()) {
        return;
      }
      params.handlers.onChunk(chunk);
    }
  }
};
