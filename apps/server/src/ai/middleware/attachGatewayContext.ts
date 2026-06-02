import type { NextFunction, Request, Response } from 'express';
import type { RequestWithContext } from '../../middleware/requestContext.js';
import type { GatewayRequestContext } from '../types/gatewayRequestContext.js';
import type { ModelRouteIntent } from '../types/modelRouteIntent.js';
import { isModelRouteIntent } from '../types/modelRouteIntent.js';

export type RequestWithGatewayContext = Request & {
  gatewayContext?: GatewayRequestContext;
};

const resolveUserId = (request: Request): string => {
  const auth = request as Request & { auth?: { sub?: string } };
  return auth.auth?.sub?.trim() || 'anonymous';
};

/** JWT sub → GatewayRequestContext，挂到 req.gatewayContext */
export const attachGatewayContext = (defaultIntent: ModelRouteIntent = 'chat') => (
  request: RequestWithGatewayContext,
  _response: Response,
  next: NextFunction,
) => {
  const headerIntent = request.header('x-kronos-intent')?.trim();
  const intent = headerIntent && isModelRouteIntent(headerIntent)
    ? headerIntent
    : defaultIntent;

  const sessionId = typeof request.body?.sessionId === 'string'
    ? request.body.sessionId.trim()
    : undefined;

  request.gatewayContext = {
    userId: resolveUserId(request),
    sessionId: sessionId || undefined,
    intent,
    traceId: (request as RequestWithContext).traceId,
  };

  next();
};
