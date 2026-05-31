import type { Request, Response } from 'express';
import { Router } from 'express';
import { isAiTaskQueueEnabled } from '../ai/queue/aiTaskQueue.js';
import { isCircuitOpen } from '../ai/circuit/circuitBreaker.js';
import { isOverGlobalTokenQuota } from '../ai/cost/isOverGlobalTokenQuota.js';
import { getSessionMetrics, resolveSessionStoreMode } from '../models/sessionStore.js';

export const aiHealthRoutes = Router();

/** AI 子系统健康快照 */
aiHealthRoutes.get('/ai/health', (_request: Request, response: Response) => {
  response.json({
    ok: true,
    queueEnabled: isAiTaskQueueEnabled(),
    globalTokenQuotaExceeded: isOverGlobalTokenQuota(),
    defaultModelCircuitOpen: isCircuitOpen(`model:${process.env.DOUBAO_MODEL ?? 'unknown'}`),
    cacheRedis: (process.env.AI_CACHE_REDIS ?? 'false').trim().toLowerCase() === 'true',
    taskStoreRedis: (process.env.AI_TASK_STORE_REDIS ?? 'false').trim().toLowerCase() === 'true',
    sessionStore: resolveSessionStoreMode(),
    sessionMetrics: getSessionMetrics(),
  });
});
