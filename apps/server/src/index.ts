import cors from 'cors';
import express from 'express';
import { allowedOrigins, env, isLocalDevOrigin } from './core/config/env.js';
import { initKnowledgeDatasetStore } from './models/knowledgeDatasetStore.js';
import { reconcileAllWorkflowExampleKnowledge } from './services/workflowExampleKnowledgeSync.js';
import { initSessionStore, resolveSessionStoreMode } from './models/sessionStore.js';
import { maybeSkipAuth } from './middleware/maybeSkipAuth.js';
import { publicAssetGuard } from './middleware/publicAssetGuard.js';
import { getRagEngineMode } from './rag/engine.js';
import { isAiTaskQueueEnabled, startAiTaskWorker } from './ai/queue/aiTaskQueue.js';
import { startWorkflowDraftWorker } from './services/workflow/workflowDraftQueue.js';
import { chatRoutes } from './controllers/chatRoutes.js';
import { createDevToken, isDevTokenRouteEnabled } from './services/auth/devTokenService.js';

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(requestOrigin) || isLocalDevOrigin(requestOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${requestOrigin}`));
    },
  }),
);
app.use(express.json({ limit: '15mb' }));

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'kronos-server' });
});

app.get('/api/dev/token', (_req, res) => {
  if (!isDevTokenRouteEnabled(process.env.NODE_ENV)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json(createDevToken(env.JWT_SECRET));
});

// 附件 / dev 缩略图 / 示例只读 GET 可跳过 JWT；其余走 authenticateJwt（见 maybeSkipAuth.ts）
app.use('/api', maybeSkipAuth, publicAssetGuard, chatRoutes);

// 启动前加载持久化 session（ESM 顶层 await）
await initSessionStore();
await initKnowledgeDatasetStore();
if (process.env.NODE_ENV === 'production') {
  void reconcileAllWorkflowExampleKnowledge().catch((error) => {
    console.warn('[workflow:example:knowledge] startup reconcile failed:', error);
  });
}

const PORT = env.PORT;

app.listen(PORT, () => {
  console.warn(`kronos server running on http://localhost:${PORT}`);
  console.warn(`Session store: ${resolveSessionStoreMode()}`);
  console.warn(`RAG engine mode: ${getRagEngineMode()}`);
  console.warn(`Workflow run store: ${env.WORKFLOW_RUN_STORE}`);
  console.warn(`Workflow run events: ${env.WORKFLOW_RUN_EVENTS_STORE}`);
  console.warn(`Workflow draft queue: ${env.WORKFLOW_QUEUE_ENABLED ? 'enabled' : 'disabled'}`);
  console.warn(`AI task queue: ${isAiTaskQueueEnabled() ? 'enabled' : 'disabled'}`);
});

if (env.WORKFLOW_QUEUE_ENABLED) {
  startWorkflowDraftWorker();
}

if (isAiTaskQueueEnabled()) {
  startAiTaskWorker();
}
