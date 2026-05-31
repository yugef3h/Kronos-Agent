import { jest } from '@jest/globals';
import type { Request, Response } from 'express';

import { clearRateLimitStore } from '../../ai/rateLimit/rateLimitStore.js';
import { matchPublicAssetRoute, publicAssetGuard } from '../../publicAssetGuard.js';

const mockRequest = (params: {
  method?: string;
  path: string;
  ip?: string;
}): Request =>
  ({
    method: params.method ?? 'GET',
    path: params.path,
    header: () => undefined,
    ip: params.ip ?? '127.0.0.1',
    socket: { remoteAddress: params.ip ?? '127.0.0.1' },
  }) as unknown as Request;

const mockResponse = (): Response & {
  statusCode: number;
  finishHandlers: Array<() => void>;
} => {
  const state = {
    statusCode: 200,
    finishHandlers: [] as Array<() => void>,
  };

  const response = {
    get statusCode() {
      return state.statusCode;
    },
    set statusCode(code: number) {
      state.statusCode = code;
    },
    setHeader: jest.fn(),
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json: jest.fn(),
    on(event: string, handler: () => void) {
      if (event === 'finish') {
        state.finishHandlers.push(handler);
      }
      return response;
    },
    finishHandlers: state.finishHandlers,
  };

  return response as unknown as Response & {
    statusCode: number;
    finishHandlers: Array<() => void>;
  };
};

describe('matchPublicAssetRoute', () => {
  it('matches attachment GET', () => {
    expect(matchPublicAssetRoute({ method: 'GET', path: '/attachments/abc-123' })).toEqual({
      kind: 'attachment',
      resourceId: 'abc-123',
    });
  });

  it('matches draft-preview GET and PUT', () => {
    expect(
      matchPublicAssetRoute({ method: 'GET', path: '/workflow/examples/demo/draft-preview' }),
    ).toEqual({
      kind: 'draft_preview',
      resourceId: 'demo',
    });
    expect(
      matchPublicAssetRoute({ method: 'PUT', path: '/workflow/apps/my-app/draft-preview' }),
    ).toEqual({
      kind: 'draft_preview',
      resourceId: 'my-app',
    });
  });

  it('ignores unrelated routes', () => {
    expect(matchPublicAssetRoute({ method: 'POST', path: '/chat/stream' })).toBeNull();
  });
});

describe('publicAssetGuard', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    clearRateLimitStore();
    warnSpy.mockClear();
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  it('returns 429 and audit log when bucket exhausted', () => {
    const request = mockRequest({ path: '/attachments/file-1', ip: '10.0.0.9' });
    const next = jest.fn();

    for (let i = 0; i < 60; i += 1) {
      publicAssetGuard(request, mockResponse(), next);
    }
    expect(next).toHaveBeenCalledTimes(60);

    const blocked = mockResponse();
    publicAssetGuard(request, blocked, next);

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'rate_limited', scope: 'public_asset_ip' }),
    );
    expect(next).toHaveBeenCalledTimes(60);

    const auditLine = warnSpy.mock.calls.at(-1)?.[0];
    expect(auditLine).toContain('"audit":"public_asset"');
    expect(auditLine).toContain('"outcome":"rate_limited"');
  });

  it('audits successful attachment access on finish', () => {
    const request = mockRequest({ path: '/attachments/file-2' });
    const response = mockResponse();
    const next = jest.fn();

    publicAssetGuard(request, response, next);
    expect(next).toHaveBeenCalledTimes(1);

    response.statusCode = 200;
    response.finishHandlers.forEach((handler) => handler());

    const auditLine = warnSpy.mock.calls.at(-1)?.[0];
    expect(auditLine).toContain('"resourceId":"file-2"');
    expect(auditLine).toContain('"outcome":"ok"');
  });
});
