import type { NextFunction, Response } from 'express';
import { releaseConcurrentSessionSlot } from '../cost/concurrentSessionSlots.js';
import type { RequestWithGatewayContext } from './attachGatewayContext.js';

/** P2-T-01: 响应结束后释放并发会话槽 */
export const releaseConcurrentSessionOnFinish = (
  request: RequestWithGatewayContext,
  response: Response,
  next: NextFunction,
): void => {
  response.on('finish', () => {
    const userId = request.gatewayContext?.userId;
    const sessionId = request.gatewayContext?.sessionId;
    if (userId && sessionId) {
      releaseConcurrentSessionSlot(userId, sessionId);
    }
  });

  next();
};
