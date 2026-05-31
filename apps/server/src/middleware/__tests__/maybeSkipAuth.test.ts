import { shouldSkipApiAuth } from '../../maybeSkipAuth.js';

const req = (params: {
  method?: string;
  path: string;
  originalUrl?: string;
}): Parameters<typeof shouldSkipApiAuth>[0] => ({
  method: params.method ?? 'GET',
  path: params.path,
  originalUrl: params.originalUrl ?? `/api${params.path}`,
});

describe('shouldSkipApiAuth', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('skips attachments in all environments', () => {
    process.env.NODE_ENV = 'production';
    expect(shouldSkipApiAuth(req({ path: '/attachments/abc' }))).toBe(true);
  });

  it('skips user app draft-preview only in non-production', () => {
    process.env.NODE_ENV = 'development';
    expect(
      shouldSkipApiAuth(
        req({
          path: '/workflow/apps/my-app/draft-preview',
          originalUrl: '/api/workflow/apps/my-app/draft-preview?v=1',
        }),
      ),
    ).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(
      shouldSkipApiAuth(
        req({
          method: 'PUT',
          path: '/workflow/apps/my-app/draft-preview',
        }),
      ),
    ).toBe(false);
  });

  it('skips workflow examples GET only', () => {
    process.env.NODE_ENV = 'production';

    expect(shouldSkipApiAuth(req({ path: '/workflow/examples' }))).toBe(true);
    expect(
      shouldSkipApiAuth(
        req({
          path: '/workflow/examples/demo-app/draft-preview',
          originalUrl: '/api/workflow/examples/demo-app/draft-preview?v=1',
        }),
      ),
    ).toBe(true);

    expect(shouldSkipApiAuth(req({ method: 'PUT', path: '/workflow/examples/demo-app' }))).toBe(false);
    expect(
      shouldSkipApiAuth(
        req({
          method: 'PUT',
          path: '/workflow/examples/demo-app/draft-preview',
        }),
      ),
    ).toBe(false);
    expect(shouldSkipApiAuth(req({ method: 'DELETE', path: '/workflow/examples/demo-app' }))).toBe(false);
  });

  it('requires auth for ordinary API routes', () => {
    process.env.NODE_ENV = 'development';
    expect(shouldSkipApiAuth(req({ path: '/chat/stream', method: 'POST' }))).toBe(false);
  });
});
