import type { SessionSnapshotResponse } from '../../lib/api';
import type { MemoryLiveMetrics } from './types';
import { MAX_CONTEXT_TOKENS } from './constants';
import { buildConversationText, countTextTokens } from './utils/chatStreamHelpers';

export type SessionSnapshotMemoryPatch = {
  memoryMetrics: MemoryLiveMetrics;
  memorySummary: string;
  memorySummaryUpdatedAt: number | null;
};

/** 将 GET /api/session/:id 的快照转为 Playground store 中的记忆指标与滚动摘要 */
export const buildSessionSnapshotMemoryPatch = async (
  snapshot: SessionSnapshotResponse,
): Promise<SessionSnapshotMemoryPatch> => {
  const [conversationTokens, summaryTokens] = await Promise.all([
    countTextTokens(buildConversationText(snapshot.messages)),
    countTextTokens(snapshot.memorySummary),
  ]);
  const budgetTokens = Math.max(0, MAX_CONTEXT_TOKENS - conversationTokens - summaryTokens);

  return {
    memorySummary: snapshot.memorySummary || '',
    memorySummaryUpdatedAt: snapshot.memorySummaryUpdatedAt,
    memoryMetrics: {
      ...snapshot.memoryMetrics,
      conversationTokensEstimate: conversationTokens,
      summaryTokensEstimate: summaryTokens,
      budgetTokensEstimate: budgetTokens,
    },
  };
};

export const applySessionSnapshotMemoryPatch = (
  patch: SessionSnapshotMemoryPatch,
  setters: {
    setMemoryMetrics: (value: MemoryLiveMetrics) => void;
    setMemorySummary: (value: string) => void;
    setMemorySummaryUpdatedAt: (value: number | null) => void;
  },
): void => {
  setters.setMemorySummary(patch.memorySummary);
  setters.setMemorySummaryUpdatedAt(patch.memorySummaryUpdatedAt);
  setters.setMemoryMetrics(patch.memoryMetrics);
};
