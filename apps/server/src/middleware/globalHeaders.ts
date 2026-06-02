import type { NextFunction, Request, Response } from 'express';
import type { RequestWithContext } from './requestContext.js';

export const globalHeaders = (req: Request, res: Response, next: NextFunction): void => {
  const traceId = (req as RequestWithContext).traceId;
  res.setHeader('X-Request-Id', traceId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
};
