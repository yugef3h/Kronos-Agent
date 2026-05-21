import type { RateLimitResult } from '../types/rateLimitResult.js';
import { sumUserTokenUsageSince } from './tokenUsageStore.js';

const dayMs = 24 * 60 * 60 * 1000;

const resolveUserDailyBudget = (): number => {
  const raw = process.env.AI_USER_TOKEN_BUDGET_PER_DAY?.trim();
  if (!raw) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** 用户日 Token 预算检查（0=不启用） */
export const checkTokenBudgetRateLimit = (
  userId: string,
  cost = 1,
  nowMs = Date.now(),
): RateLimitResult => {
  const budget = resolveUserDailyBudget();
  if (budget <= 0) {
    return { allowed: true, scope: 'token_budget', remaining: budget, retryAfterMs: 0 };
  }

  const used = sumUserTokenUsageSince(userId, nowMs - dayMs);
  const remaining = Math.max(0, budget - used);
  const allowed = used + cost <= budget;

  return {
    allowed,
    scope: 'token_budget',
    remaining,
    retryAfterMs: allowed ? 0 : dayMs,
  };
};
