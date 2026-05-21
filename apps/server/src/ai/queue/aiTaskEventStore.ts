import type { AiTaskEvent } from './aiTaskEvents.js';

/** P4-Q-01: 任务事件存储接口 */
export type AiTaskEventStore = {
  append: (taskId: string, type: AiTaskEvent['type'], data?: Record<string, unknown>) => Promise<AiTaskEvent>;
  list: (taskId: string, afterId?: number) => Promise<AiTaskEvent[]>;
  clear: (taskId: string) => Promise<void>;
};
