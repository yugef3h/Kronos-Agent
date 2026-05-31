import type { Request } from 'express';

export const getClientIp = (request: Request): string => {
  const forwarded = request.header('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
};
