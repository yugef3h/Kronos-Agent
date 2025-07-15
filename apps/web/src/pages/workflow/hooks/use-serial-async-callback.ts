import { useCallback, useRef } from 'react';

export const useSerialAsyncCallback = <Args extends unknown[], Result>(
  callback: (...args: Args) => Promise<Result>,
  shouldSkip?: () => boolean,
) => {
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  return useCallback((...args: Args): Promise<Result | undefined> => {
    if (shouldSkip?.()) {
      return Promise.resolve(undefined);
    }

    const run = async () => callback(...args);
    const nextTask = queueRef.current.then(run, run);

    queueRef.current = nextTask.then(() => undefined, () => undefined);

    return nextTask;
  }, [callback, shouldSkip]);
};