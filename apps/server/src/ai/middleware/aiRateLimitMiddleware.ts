import type { NextFunction, Response } from 'express';
import { checkSessionRateLimit } from '../rateLimit/checkSessionRateLimit.js';
import { checkUserRateLimit } from '../rateLimit/checkUserRateLimit.js';
import { acquireConcurrentSessionSlot } from '../cost/concurrentSessionSlots.js';
import { isOverGlobalTokenQuota } from '../cost/isOverGlobalTokenQuota.js';
import type { RequestWithGatewayContext } from './attachGatewayContext.js';

/** T-10: chat / ai 入口限流 */
export const aiRateLimitMiddleware = (
  request: RequestWithGatewayContext,
  response: Response,
  next: NextFunction,
): void => {
  const ctx = request.gatewayContext;
  const userId = ctx?.userId ?? 'anonymous';

  if (isOverGlobalTokenQuota()) {
    response.status(503).json({ error: 'Global token quota exceeded', code: 'token_quota_exceeded' });
    return;
  }

  const userLimit = checkUserRateLimit(userId);
  if (!userLimit.allowed) {
    response.setHeader('Retry-After', String(Math.ceil(userLimit.retryAfterMs / 1000)));
    response.status(429).json({ error: 'Too many requests', code: 'rate_limited', scope: userLimit.scope });
    return;
  }

  const sessionId = ctx?.sessionId;
  if (sessionId) {
    const sessionLimit = checkSessionRateLimit(sessionId);
    if (!sessionLimit.allowed) {
      response.setHeader('Retry-After', String(Math.ceil(sessionLimit.retryAfterMs / 1000)));
      response.status(429).json({ error: 'Too many requests', code: 'rate_limited', scope: sessionLimit.scope });
      return;
    }

    if (!acquireConcurrentSessionSlot(userId, sessionId)) {
      response.status(429).json({ error: 'Too many concurrent AI sessions', code: 'concurrent_session_limited' });
      return;
    }
  }

  next();
};
