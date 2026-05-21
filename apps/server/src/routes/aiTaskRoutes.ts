import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { computeTaskPriority } from '../ai/queue/computeTaskPriority.js';
import { enqueueAiTask, isAiTaskQueueEnabled } from '../ai/queue/aiTaskQueue.js';
import { listAiTaskEvents } from '../ai/queue/aiTaskEvents.js';
import { getAiTaskStore } from '../ai/queue/getAiTaskStore.js';
import type { AiTaskKind } from '../ai/types/aiTaskKind.js';

const createTaskSchema = z.object({
  kind: z.enum(['chat', 'workflow_draft', 'image', 'embedding_batch']),
  payload: z.record(z.unknown()).default({}),
  userTier: z.enum(['free', 'paid']).optional(),
});

export const aiTaskRoutes = Router();

/** Q-10: 创建异步 AI 任务 */
aiTaskRoutes.post('/ai/tasks', async (request: Request, response: Response) => {
  const parsed = createTaskSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid task body' });
    return;
  }

  const kind = parsed.data.kind as AiTaskKind;
  const priority = computeTaskPriority({ kind, userTier: parsed.data.userTier });
  const record = await getAiTaskStore().create({ kind, priority, payload: parsed.data.payload });

  if (isAiTaskQueueEnabled()) {
    await enqueueAiTask(record);
  }

  response.status(201).json({
    taskId: record.taskId,
    status: record.status,
    priority: record.priority,
    queued: isAiTaskQueueEnabled(),
  });
});

/** Q-10: 查询任务状态 */
aiTaskRoutes.get('/ai/tasks/:taskId', async (request: Request, response: Response) => {
  const taskId = String(request.params.taskId || '').trim();
  if (!taskId) {
    response.status(400).json({ error: 'Invalid task id' });
    return;
  }

  const task = await getAiTaskStore().get(taskId);
  if (!task) {
    response.status(404).json({ error: 'Task not found' });
    return;
  }

  response.json({ task });
});

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

/** P2-Q-06: 任务事件 SSE（轮询至终态或超时） */
aiTaskRoutes.get('/ai/tasks/:taskId/events', async (request: Request, response: Response) => {
  const taskId = String(request.params.taskId || '').trim();
  if (!taskId) {
    response.status(400).json({ error: 'Invalid task id' });
    return;
  }

  const task = await getAiTaskStore().get(taskId);
  if (!task) {
    response.status(404).json({ error: 'Task not found' });
    return;
  }

  const lastEventId = Number(request.header('last-event-id') || '0');
  response.setHeader('Content-Type', 'text/event-stream;charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');

  const deadline = Date.now() + 120_000;
  let cursor = lastEventId;

  while (Date.now() < deadline) {
    const events = listAiTaskEvents(taskId, cursor);
    for (const event of events) {
      response.write(`data: ${JSON.stringify(event)}\nid: ${event.id}\n\n`);
      cursor = event.id;
    }

    const latest = await getAiTaskStore().get(taskId);
    if (latest && TERMINAL_STATUSES.has(latest.status)) {
      break;
    }

    await new Promise((resolve) => { setTimeout(resolve, 400); });
  }

  response.end();
});
