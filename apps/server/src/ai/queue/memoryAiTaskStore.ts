import { randomUUID } from 'node:crypto';
import type { AiTaskRecord } from '../types/aiTaskRecord.js';
import type { AiTaskStatus } from '../types/aiTaskStatus.js';

const tasks = new Map<string, AiTaskRecord>();

/** Q-08: 内存异步任务表 */
export const createAiTask = (
  partial: Pick<AiTaskRecord, 'kind' | 'priority' | 'payload'> & { taskId?: string },
): AiTaskRecord => {
  const now = Date.now();
  const record: AiTaskRecord = {
    taskId: partial.taskId ?? randomUUID(),
    kind: partial.kind,
    priority: partial.priority,
    payload: partial.payload,
    status: 'queued',
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };

  tasks.set(record.taskId, record);
  return record;
};

export const getAiTask = async (taskId: string): Promise<AiTaskRecord | null> =>
  tasks.get(taskId) ?? null;

export const patchAiTask = async (
  taskId: string,
  patch: Partial<Pick<AiTaskRecord, 'status' | 'progress' | 'result' | 'error'>>,
): Promise<AiTaskRecord | null> => {
  const existing = tasks.get(taskId);
  if (!existing) {
    return null;
  }

  const updated: AiTaskRecord = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };
  tasks.set(taskId, updated);
  return updated;
};

export const listAiTasksByStatus = async (status: AiTaskStatus): Promise<AiTaskRecord[]> =>
  [...tasks.values()].filter((task) => task.status === status);

export const clearAiTaskStore = (): void => {
  tasks.clear();
};
