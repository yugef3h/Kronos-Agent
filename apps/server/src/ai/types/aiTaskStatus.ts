/** 异步 AI 任务状态 */
export type AiTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export const AI_TASK_STATUSES: readonly AiTaskStatus[] = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const;
