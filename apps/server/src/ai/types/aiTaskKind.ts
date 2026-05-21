/** 异步 AI 任务类型 */
export type AiTaskKind = 'chat' | 'workflow_draft' | 'image' | 'embedding_batch';

export const AI_TASK_KINDS: readonly AiTaskKind[] = [
  'chat',
  'workflow_draft',
  'image',
  'embedding_batch',
] as const;
