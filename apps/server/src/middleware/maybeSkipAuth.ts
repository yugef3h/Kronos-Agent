import type { Request, Response, NextFunction } from 'express';

import { authenticateJwt } from './authenticateJwt.js';

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

const isAttachmentPath = (path: string): boolean => path.startsWith('/attachments/');

const isWorkflowExampleRoute = (path: string, originalUrl: string): boolean =>
  path.startsWith('/workflow/examples') || originalUrl.startsWith('/api/workflow/examples');

const isUserAppDraftPreviewRoute = (path: string, originalUrl: string): boolean =>
  (path.includes('/draft-preview') && path.startsWith('/workflow/apps/'))
  || (originalUrl.includes('/draft-preview') && originalUrl.startsWith('/api/workflow/apps/'));

/** 是否跳过 JWT（供单测与 middleware 共用） */
export const shouldSkipApiAuth = (req: Pick<Request, 'method' | 'path' | 'originalUrl'>): boolean => {
  if (isAttachmentPath(req.path)) {
    return true;
  }

  // 用户应用缩略图：<img> 无法带 Authorization；仅 dev 跳过
  if (isUserAppDraftPreviewRoute(req.path, req.originalUrl) && !isProduction()) {
    return true;
  }

  // 内置示例：仅 GET 公开（列表 + 缩略图）；PUT/DELETE 需 JWT
  if (isWorkflowExampleRoute(req.path, req.originalUrl) && req.method === 'GET') {
    return true;
  }

  return false;
};

export const maybeSkipAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (shouldSkipApiAuth(req)) {
    next();
    return;
  }

  authenticateJwt(req, res, next);
};
