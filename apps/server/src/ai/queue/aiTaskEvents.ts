import { getAiTaskEventStore } from './getAiTaskEventStore.js';
import { clearAllMemoryAiTaskEvents } from './memoryAiTaskEventStore.js';

export type AiTaskEvent = {
  id: number;
  taskId: string;
  type: 'status' | 'progress' | 'content' | 'error' | 'done';
  data: Record<string, unknown>;
  timestamp: number;
};

/** P4-Q-04: 追加任务事件（memory / redis） */
export const appendAiTaskEvent = async (
  taskId: string,
  type: AiTaskEvent['type'],
  data: Record<string, unknown> = {},
): Promise<AiTaskEvent> => getAiTaskEventStore().append(taskId, type, data);

/** P2-Q-01 / P4-Q-04: 列出任务事件 */
export const listAiTaskEvents = async (taskId: string, afterId = 0): Promise<AiTaskEvent[]> =>
  getAiTaskEventStore().list(taskId, afterId);

export const clearAiTaskEvents = async (taskId: string): Promise<void> => {
  await getAiTaskEventStore().clear(taskId);
};

/** 测试清理（仅内存实现） */
export const clearAllAiTaskEvents = (): void => {
  clearAllMemoryAiTaskEvents();
};
