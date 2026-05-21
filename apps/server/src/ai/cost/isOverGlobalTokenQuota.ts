import { sumGlobalTokenUsageSince } from './tokenUsageStore.js';

const dayMs = 24 * 60 * 60 * 1000;

const resolveDailyQuota = (): number => {
  const raw = process.env.AI_GLOBAL_TOKEN_QUOTA_PER_DAY?.trim();
  if (!raw) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** T-09: 全局日 Token 配额是否已用尽（0 表示不启用） */
export const isOverGlobalTokenQuota = (nowMs = Date.now()): boolean => {
  const quota = resolveDailyQuota();
  if (quota <= 0) {
    return false;
  }

  const used = sumGlobalTokenUsageSince(nowMs - dayMs);
  return used >= quota;
};
