import type { AiTaskKind } from '../types/aiTaskKind.js';
import {
  AI_TASK_PRIORITY_CORE_BUSINESS,
  AI_TASK_PRIORITY_DEFAULT,
  AI_TASK_PRIORITY_PAID_USER,
  type AiTaskPriority,
} from '../types/aiTaskPriority.js';

export type TaskPriorityContext = {
  userTier?: 'free' | 'paid';
  kind: AiTaskKind;
};

/** Q-05: 用户档位 + 任务类型 → 优先级 */
export const computeTaskPriority = (ctx: TaskPriorityContext): AiTaskPriority => {
  if (ctx.kind === 'workflow_draft') {
    return AI_TASK_PRIORITY_CORE_BUSINESS;
  }

  if (ctx.userTier === 'paid') {
    return AI_TASK_PRIORITY_PAID_USER;
  }

  return AI_TASK_PRIORITY_DEFAULT;
};
