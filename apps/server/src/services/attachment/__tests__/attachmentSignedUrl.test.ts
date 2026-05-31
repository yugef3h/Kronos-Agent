import { createHmac } from 'crypto';

import { env } from '../../../core/config/env.js';
import {
  ATTACHMENT_URL_TTL_SEC,
  buildSignedAttachmentPath,
  signAttachmentAccess,
  verifyAttachmentAccess,
} from '../../attachmentSignedUrl.js';

describe('attachmentSignedUrl', () => {
  const attachmentId = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-16ch';
  });

  it('builds a verifiable signed path', () => {
    const path = buildSignedAttachmentPath(attachmentId);
    const url = new URL(path, 'http://localhost');
    expect(url.pathname).toBe(`/api/attachments/${attachmentId}`);
    expect(verifyAttachmentAccess(attachmentId, url.searchParams.get('exp')!, url.searchParams.get('sig')!)).toBe(true);
  });

  it('rejects expired signatures', () => {
    const { exp, sig } = signAttachmentAccess(attachmentId, 60, 1_700_000_000);
    expect(verifyAttachmentAccess(attachmentId, String(exp), sig, 1_700_000_100)).toBe(false);
  });

  it('rejects tampered attachment id', () => {
    const { exp, sig } = signAttachmentAccess(attachmentId);
    expect(verifyAttachmentAccess('other-id', String(exp), sig)).toBe(false);
  });

  it('rejects missing query params', () => {
    expect(verifyAttachmentAccess(attachmentId, '', '')).toBe(false);
  });

  it('uses JWT_SECRET for signing', () => {
    const { exp, sig } = signAttachmentAccess(attachmentId, ATTACHMENT_URL_TTL_SEC);
    const wrongSecretSig = createHmac('sha256', 'wrong-secret-123456')
      .update(`${attachmentId}:${exp}`)
      .digest('hex');
    expect(verifyAttachmentAccess(attachmentId, String(exp), wrongSecretSig)).toBe(false);
    expect(verifyAttachmentAccess(attachmentId, String(exp), sig)).toBe(true);
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(16);
  });
});
