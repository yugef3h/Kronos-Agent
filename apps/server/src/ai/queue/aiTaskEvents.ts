export type AiTaskEvent = {
  id: number;
  taskId: string;
  type: 'status' | 'progress' | 'content' | 'error' | 'done';
  data: Record<string, unknown>;
  timestamp: number;
};

const eventsByTask = new Map<string, AiTaskEvent[]>();

/** P2-Q-01: 追加任务事件 */
export const appendAiTaskEvent = (
  taskId: string,
  type: AiTaskEvent['type'],
  data: Record<string, unknown> = {},
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

/** P2-Q-01: 列出任务事件（可按 lastEventId 过滤） */
export const listAiTaskEvents = (taskId: string, afterId = 0): AiTaskEvent[] =>
  (eventsByTask.get(taskId) ?? []).filter((event) => event.id > afterId);

export const clearAiTaskEvents = (taskId: string): void => {
  eventsByTask.delete(taskId);
};

export const clearAllAiTaskEvents = (): void => {
  eventsByTask.clear();
};
