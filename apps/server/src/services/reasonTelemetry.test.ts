import {
  createFirstTokenInfoMessage,
  createFirstTokenSlowWarningMessage,
  createReasonCompletedMessage,
  createReasonRequestInfoMessage,
  raceFirstChunkWithTimeout,
} from './reasonTelemetry';

describe('reasonTelemetry', () => {
  it('should format reason request info message', () => {
    expect(createReasonRequestInfoMessage(128)).toContain('请求建立耗时 128ms');
  });

  it('should format first token info and warning message', () => {
    expect(createFirstTokenInfoMessage(952)).toContain('首 token 耗时 952ms');
    expect(createFirstTokenSlowWarningMessage(3000)).toContain('超过 3000ms');
  });

  it('should format completed message with first token metric', () => {
    const message = createReasonCompletedMessage({
      totalElapsedMs: 5040,
      firstTokenElapsedMs: 1180,
    });

    expect(message).toContain('总耗时 5040ms');
    expect(message).toContain('首 token 耗时 1180ms');
  });

  it('should format completed message when no text token captured', () => {
    const message = createReasonCompletedMessage({
      totalElapsedMs: 800,
      firstTokenElapsedMs: null,
    });

    expect(message).toContain('总耗时 800ms');
    expect(message).toContain('未捕获到文本 token');
  });

  it('should report timeout when first chunk promise is slower than threshold', async () => {
    const slowChunkPromise = new Promise((resolve) => {
      setTimeout(() => resolve('slow-chunk'), 30);
    });

    const result = await raceFirstChunkWithTimeout({
      firstChunkPromise: slowChunkPromise,
      timeoutMs: 5,
    });

    expect(result.timedOut).toBe(true);
  });

  it('should report non-timeout when first chunk arrives quickly', async () => {
    const quickChunkPromise = Promise.resolve('quick-chunk');

    const result = await raceFirstChunkWithTimeout({
      firstChunkPromise: quickChunkPromise,
      timeoutMs: 50,
    });

    expect(result.timedOut).toBe(false);
  });
});
