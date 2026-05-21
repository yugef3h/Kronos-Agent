export type RetryOptions = {
  maxAttempts: number;
  backoffMs: number;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/** 带指数退避的重试 */
export const invokeWithRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const maxAttempts = Math.max(1, options.maxAttempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        break;
      }

      const delay = options.backoffMs * (2 ** (attempt - 1));
      await sleep(delay);
    }
  }

  throw lastError;
};
