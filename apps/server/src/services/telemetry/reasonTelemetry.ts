export const createReasonRequestInfoMessage = (setupElapsedMs: number): string => {
  return `推理请求已发送，等待首 token（请求建立耗时 ${setupElapsedMs}ms）。`;
};

export const createFirstTokenInfoMessage = (firstTokenElapsedMs: number): string => {
  return `推理首 token 已到达（首 token 耗时 ${firstTokenElapsedMs}ms）。`;
};

export const createFirstTokenSlowWarningMessage = (timeoutMs: number): string => {
  return `推理首 token 等待超过 ${timeoutMs}ms，模型仍在生成中。`;
};

export const createReasonCompletedMessage = (params: {
  totalElapsedMs: number;
  firstTokenElapsedMs: number | null;
}): string => {
  if (params.firstTokenElapsedMs === null) {
    return `推理器已完成流式响应。（总耗时 ${params.totalElapsedMs}ms，未捕获到文本 token）`;
  }

  return `推理器已完成流式响应。（总耗时 ${params.totalElapsedMs}ms，首 token 耗时 ${params.firstTokenElapsedMs}ms）`;
};

export const raceFirstChunkWithTimeout = async (params: {
  firstChunkPromise: Promise<unknown>;
  timeoutMs: number;
}): Promise<{ timedOut: boolean }> => {
  const raceResult = await Promise.race([
    params.firstChunkPromise.then(() => 'chunk' as const),
    new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), params.timeoutMs);
    }),
  ]);

  return {
    timedOut: raceResult === 'timeout',
  };
};
