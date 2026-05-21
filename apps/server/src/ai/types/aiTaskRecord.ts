import type { AiTaskKind } from './aiTaskKind.js';
import type { AiTaskStatus } from './aiTaskStatus.js';

/** 异步 AI 任务记录 */
export type AiTaskRecord = {
  taskId: string;
  kind: AiTaskKind;
  priority: number;
  payload: Record<string, unknown>;
  status: AiTaskStatus;
  progress: number;
  createdAt: number;
  updatedAt: number;
  result?: unknown;
  error?: string;
};
