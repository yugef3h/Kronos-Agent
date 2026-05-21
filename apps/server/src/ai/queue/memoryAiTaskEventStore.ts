import type { AiTaskEvent } from './aiTaskEvents.js';
import type { AiTaskEventStore } from './aiTaskEventStore.js';

const eventsByTask = new Map<string, AiTaskEvent[]>();

const buildEvent = (
  taskId: string,
  type: AiTaskEvent['type'],
  data: Record<string, unknown>,
): AiTaskEvent => {
  const list = eventsByTask.get(taskId) ?? [];
  const event: AiTaskEvent = {
    id: list.length + 1,
    taskId,
    type,
    data,
    timestamp: Date.now(),
  };
  list.push(event);
  eventsByTask.set(taskId, list);
  return event;
};

/** P4-Q-02: 内存任务事件存储 */
export const memoryAiTaskEventStore: AiTaskEventStore = {
  async append(taskId, type, data = {}) {
    return buildEvent(taskId, type, data);
  },

  async list(taskId, afterId = 0) {
    return (eventsByTask.get(taskId) ?? []).filter((event) => event.id > afterId);
  },

  async clear(taskId) {
    eventsByTask.delete(taskId);
  },
};

export const clearAllMemoryAiTaskEvents = (): void => {
  eventsByTask.clear();
};
