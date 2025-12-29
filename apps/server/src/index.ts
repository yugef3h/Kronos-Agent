import cors from 'cors';
import express from 'express';
import { allowedOrigins, env } from './config/env.js';
import { initKnowledgeDatasetStore } from './domain/knowledgeDatasetStore.js';
import { initSessionStore } from './domain/sessionStore.js';
import { authenticateJwt } from './middleware/authenticateJwt.js';
import { getRagEngineMode } from './rag/engine.js';
import { chatRoutes } from './routes/chatRoutes.js';
import { createDevToken, isDevTokenRouteEnabled } from './services/devTokenService.js';

const app = express();

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(requestOrigin)) {
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

// 附件文件流需要被 <img> 直接访问，无法带 Authorization 头。
const maybeSkipAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/attachments/')) {
    next();
    return;
  }
  // 列表缩略图：<img> 与 PUT 均可能无 JWT（与附件类似，仅本地 dev 数据）
  if (
    req.originalUrl.startsWith('/api/workflow/apps/') &&
    req.originalUrl.includes('/draft-preview')
  ) {
    next();
    return;
  }
  // 仓库内置示例：只读列表与缩略图无需 JWT（fork 开箱可见）
  if (req.originalUrl.startsWith('/api/workflow/examples')) {
    next();
    return;
  }
  authenticateJwt(req, res, next);
};

app.use('/api', maybeSkipAuth, chatRoutes);

// 启动前加载持久化 session（ESM 顶层 await）
await initSessionStore();
await initKnowledgeDatasetStore();

const PORT = env.PORT;

app.listen(PORT, () => {
  console.warn(`kronos server running on http://localhost:${PORT}`);
  console.warn(`RAG engine mode: ${getRagEngineMode()}`);
});
