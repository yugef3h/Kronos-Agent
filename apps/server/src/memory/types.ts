import type { Message } from '../domain/sessionStore.js';

export type SessionMemoryState = {
  summary: string;
  summaryUpdatedAt: number | null;
};

export type MemoryPlan = {
  history: Message[];
  memorySummary: string;
  summaryUpdated: boolean;
  diagnostics: {
    totalInputTokensEstimate: number;
    budgetTokensEstimate: number;
    historyTokensEstimate: number;
    summaryTokensEstimate: number;
    promptTokensEstimate: number;
  };
};
