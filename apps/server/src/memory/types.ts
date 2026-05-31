import type { Message } from '../models/sessionStore.js';

export type SessionMemoryState = {
  summary: string;
  summaryUpdatedAt: number | null;
  /** 已折叠进 `summary` 的「前缀消息」条数，用于避免同一 transcript 上重复 merge */
  summaryArchiveMessageCount?: number;
};

export type MemoryPlan = {
  history: Message[];
  memorySummary: string;
  summaryUpdated: boolean;
  /** 本轮结束后的 `summaryArchiveMessageCount`（与 Session 对齐） */
  summaryArchiveMessageCount: number;
  diagnostics: {
    totalInputTokensEstimate: number;
    budgetTokensEstimate: number;
    historyTokensEstimate: number;
    summaryTokensEstimate: number;
    promptTokensEstimate: number;
  };
};
