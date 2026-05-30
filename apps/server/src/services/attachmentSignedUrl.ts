import { createHmac, timingSafeEqual } from 'crypto';

import { env } from '../config/env.js';

/** 与 dev JWT 同量级；`<img>` 直链在有效期内可重复访问 */
export const ATTACHMENT_URL_TTL_SEC = 7 * 24 * 3600;

export type AttachmentAccessSignature = {
  exp: number;
  sig: string;
};

export const signAttachmentAccess = (
  attachmentId: string,
  ttlSec = ATTACHMENT_URL_TTL_SEC,
  nowSec = Math.floor(Date.now() / 1000),
): AttachmentAccessSignature => {
  const exp = nowSec + ttlSec;
  const sig = createHmac('sha256', env.JWT_SECRET)
    .update(`${attachmentId}:${exp}`)
    .digest('hex');

  return { exp, sig };
};

export const buildSignedAttachmentPath = (
  attachmentId: string,
  ttlSec = ATTACHMENT_URL_TTL_SEC,
): string => {
  const { exp, sig } = signAttachmentAccess(attachmentId, ttlSec);
  return `/api/attachments/${encodeURIComponent(attachmentId)}?exp=${exp}&sig=${encodeURIComponent(sig)}`;
};

export const verifyAttachmentAccess = (
  attachmentId: string,
  expRaw: string,
  sigRaw: string,
  nowSec = Math.floor(Date.now() / 1000),
): boolean => {
  const exp = Number(expRaw);
  const sig = sigRaw.trim();

  if (!attachmentId.trim() || !Number.isFinite(exp) || exp <= nowSec || !sig) {
    return false;
  }

  const expected = createHmac('sha256', env.JWT_SECRET)
    .update(`${attachmentId}:${exp}`)
    .digest('hex');

  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(sig, 'hex');
    if (expectedBuf.length !== sigBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
};
