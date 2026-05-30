import type { NextFunction, Request, Response } from 'express';

import {
  inferPublicAssetOutcome,
  logPublicAssetAccess,
  type PublicAssetAuditEvent,
} from '../audit/publicAssetAuditLog.js';
import { checkPublicAssetRateLimit } from '../rateLimit/checkPublicAssetRateLimit.js';
import { getClientIp } from '../utils/clientIp.js';

export type PublicAssetRouteMeta = {
  kind: 'attachment' | 'draft_preview';
  resourceId: string;
};

export const matchPublicAssetRoute = (
  request: Pick<Request, 'method' | 'path'>,
): PublicAssetRouteMeta | null => {
  if (request.method === 'GET' && request.path.startsWith('/attachments/')) {
    const resourceId = request.path.slice('/attachments/'.length).split('/')[0];
    if (resourceId) {
      return { kind: 'attachment', resourceId: decodeURIComponent(resourceId) };
    }
  }

  const draftPreviewMatch = /^\/workflow\/(?:apps|examples)\/([^/]+)\/draft-preview$/.exec(request.path);
  if (draftPreviewMatch && (request.method === 'GET' || request.method === 'PUT')) {
    return { kind: 'draft_preview', resourceId: draftPreviewMatch[1] };
  }

  return null;
};

const buildAuditBase = (
  request: Request,
  meta: PublicAssetRouteMeta,
  ip: string,
): Omit<PublicAssetAuditEvent, 'status' | 'outcome'> => ({
  ts: new Date().toISOString(),
  kind: meta.kind,
  method: request.method,
  path: request.path,
  resourceId: meta.resourceId,
  ip,
});

/** 附件 / draft-preview 限流 + audit（demo：按 IP 令牌桶） */
export const publicAssetGuard = (request: Request, response: Response, next: NextFunction): void => {
  const meta = matchPublicAssetRoute(request);
  if (!meta) {
    next();
    return;
  }

  const ip = getClientIp(request);
  const isWrite = request.method === 'PUT';
  const limit = checkPublicAssetRateLimit(ip, isWrite);

  if (!limit.allowed) {
    logPublicAssetAccess({
      ...buildAuditBase(request, meta, ip),
      status: 429,
      outcome: 'rate_limited',
    });
    response.setHeader('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)));
    response.status(429).json({
      error: 'Too many requests',
      code: 'rate_limited',
      scope: limit.scope,
    });
    return;
  }

  response.on('finish', () => {
    logPublicAssetAccess({
      ...buildAuditBase(request, meta, ip),
      status: response.statusCode,
      outcome: inferPublicAssetOutcome(response.statusCode),
    });
  });

  next();
};
