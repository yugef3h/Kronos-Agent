/** P4-W-01: chat-stream 202 异步任务响应 */
export type ChatAsyncAccepted = {
  taskId: string;
  status: string;
  pollUrl: string;
  eventsUrl: string;
};

/** P4-W-01: 任务 SSE 事件（/api/ai/tasks/:id/events） */
export type AiTaskSseEvent = {
  id: number;
  taskId: string;
  type: 'status' | 'progress' | 'content' | 'error' | 'done';
  data: Record<string, unknown>;
  timestamp: number;
};
