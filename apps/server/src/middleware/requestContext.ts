import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithContext = Request & { traceId: string };

export const requestContext = (req: Request, _res: Response, next: NextFunction): void => {
  (req as RequestWithContext).traceId =
    req.header('x-kronos-trace-id')?.trim() || randomUUID();
  next();
};
