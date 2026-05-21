import type { AiTaskRecord } from '../types/aiTaskRecord.js';
import type { AiTaskStatus } from '../types/aiTaskStatus.js';

/** P3-Q-01: 任务存储接口 */
export type AiTaskStore = {
  create: (
    partial: Pick<AiTaskRecord, 'kind' | 'priority' | 'payload'> & { taskId?: string },
  ) => Promise<AiTaskRecord>;
  get: (taskId: string) => Promise<AiTaskRecord | null>;
  patch: (
    taskId: string,
    patch: Partial<Pick<AiTaskRecord, 'status' | 'progress' | 'result' | 'error'>>,
  ) => Promise<AiTaskRecord | null>;
  listByStatus: (status: AiTaskStatus) => Promise<AiTaskRecord[]>;
};
