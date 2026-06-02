import type { Express } from 'express';
import * as Sentry from '@sentry/node';
import { env } from '../core/config/env.js';

let initialized = false;

/** 初始化 Sentry —— 必须在其他中间件之前调用。不配置 SENTRY_DSN 则跳过。 */
export function initSentry(app: Express): void {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    integrations: [Sentry.expressIntegration()],
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
  });

  initialized = true;
}

/** 注册 Sentry 错误处理器 —— 必须在所有路由之后调用。 */
export function setupSentryErrorHandler(app: Express): void {
  if (!initialized) {
    return;
  }

  Sentry.setupExpressErrorHandler(app);
}
