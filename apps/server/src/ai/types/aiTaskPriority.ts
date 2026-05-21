/** Q-04: 任务优先级常量（BullMQ：数值越大越优先） */
export type AiTaskPriority = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const AI_TASK_PRIORITY_DEFAULT = 3 satisfies AiTaskPriority;
export const AI_TASK_PRIORITY_PAID_USER = 7 satisfies AiTaskPriority;
export const AI_TASK_PRIORITY_CORE_BUSINESS = 8 satisfies AiTaskPriority;
