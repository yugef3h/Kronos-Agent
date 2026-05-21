type TokenUsageRecord = {
  input: number;
  output: number;
  model: string;
  at: number;
};

const usageByUser = new Map<string, TokenUsageRecord[]>();

/** 记录用户 Token 消耗 */
export const recordTokenUsage = (
  userId: string,
  usage: { input: number; output: number; model: string },
  nowMs = Date.now(),
): void => {
  const rows = usageByUser.get(userId) ?? [];
  rows.push({
    input: Math.max(0, usage.input),
    output: Math.max(0, usage.output),
    model: usage.model,
    at: nowMs,
  });
  usageByUser.set(userId, rows);
};

export const sumUserTokenUsageSince = (userId: string, sinceMs: number): number => {
  const rows = usageByUser.get(userId) ?? [];
  return rows
    .filter((row) => row.at >= sinceMs)
    .reduce((sum, row) => sum + row.input + row.output, 0);
};

export const sumGlobalTokenUsageSince = (sinceMs: number): number => {
  let total = 0;
  for (const userId of usageByUser.keys()) {
    total += sumUserTokenUsageSince(userId, sinceMs);
  }
  return total;
};

export const clearTokenUsageStore = (): void => {
  usageByUser.clear();
};
