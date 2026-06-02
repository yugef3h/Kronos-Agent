import type { NextFunction, Request, Response } from 'express';
import type { RequestWithContext } from './requestContext.js';

const SKIP_PATHS = new Set(['/healthz']);

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  if (SKIP_PATHS.has(req.path)) {
    next();
    return;
  }

  const start = Date.now();
  res.on('finish', () => {
    const ctx = req as RequestWithContext;
    console.warn(JSON.stringify({
      ts: new Date().toISOString(),
      traceId: ctx.traceId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
    }));
  });
  next();
};
