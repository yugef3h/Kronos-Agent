/** 多路检索并行执行 */
export const runParallelRetrievalPaths = async <T>(
  paths: Array<() => Promise<T>>,
): Promise<T[]> => Promise.all(paths.map((run) => run()));
