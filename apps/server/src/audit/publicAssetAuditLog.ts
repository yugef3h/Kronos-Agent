export type PublicAssetAuditOutcome =
  | 'ok'
  | 'sig_invalid'
  | 'not_found'
  | 'rate_limited'
  | 'error';

export type PublicAssetAuditEvent = {
  ts: string;
  kind: 'attachment' | 'draft_preview';
  method: string;
  path: string;
  resourceId: string;
  status: number;
  outcome: PublicAssetAuditOutcome;
  ip: string;
};

export const inferPublicAssetOutcome = (status: number): PublicAssetAuditOutcome => {
  if (status === 429) {
    return 'rate_limited';
  }
  if (status === 401) {
    return 'sig_invalid';
  }
  if (status === 404) {
    return 'not_found';
  }
  if (status >= 200 && status < 300) {
    return 'ok';
  }
  return 'error';
};

export const logPublicAssetAccess = (event: PublicAssetAuditEvent): void => {
  console.warn(JSON.stringify({ audit: 'public_asset', ...event }));
};
