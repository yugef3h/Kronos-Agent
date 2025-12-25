import type { Message } from '../domain/sessionStore.js';
import {
  CONTEXT_WINDOW_TOKENS,
  INPUT_BUDGET_RATIO,
  MAX_SUMMARY_CHARS,
  RECENT_MESSAGES_TO_KEEP,
  RESERVED_OUTPUT_TOKENS,
  SUMMARY_TRIGGER_MESSAGE_COUNT,
} from './constants.js';
import { estimateTextTokens } from './tokenEstimate.js';
import type { MemoryPlan, SessionMemoryState } from './types.js';

const trimToMaxChars = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) {
    return text;
  }

  const head = text.slice(0, Math.floor(maxChars * 0.35));
  const tail = text.slice(-(maxChars - head.length - 5));
  return `${head}\n...\n${tail}`;
};

const formatMessageLine = (message: Message, index: number): string => {
  const speaker = message.role === 'user' ? '用户' : '助手';
  const compactText = message.content.replace(/\s+/g, ' ').trim();
  return `${index + 1}. ${speaker}: ${compactText}`;
};

/** 去掉历史 merge 误嵌套的「已有摘要:」前缀，保留正文用于滚动追加 */
const normalizeStoredSummary = (summary: string): string => {
  let text = summary.trim();
  const legacyPrefix = '已有摘要:';

  while (text.startsWith(legacyPrefix)) {
    text = text.slice(legacyPrefix.length).trimStart();
  }

  return text;
};

const buildMergedSummary = (existingSummary: string, historyToSummarize: Message[]): string => {
  const lines = historyToSummarize.map(formatMessageLine);
  const recentDigest = trimToMaxChars(lines.join('\n'), 900);
  const prior = normalizeStoredSummary(existingSummary);
  const merged = prior.length
    ? `${prior}\n\n新增对话摘要:\n${recentDigest}`
    : `对话摘要:\n${recentDigest}`;

  // 这里采用确定性压缩，避免在摘要阶段再次调用模型造成额外 token 消耗和时延。
  return trimToMaxChars(merged, MAX_SUMMARY_CHARS);
};

export const createMemoryPlan = (params: {
  prompt: string;
  messages: Message[];
  memoryState: SessionMemoryState;
}): MemoryPlan => {
  const { prompt, messages } = params;
  const memoryState: SessionMemoryState = {
    summary: params.memoryState.summary || '',
    summaryUpdatedAt: params.memoryState.summaryUpdatedAt,
  };

  let summaryUpdated = false;
  let summaryArchiveMessageCount = params.memoryState.summaryArchiveMessageCount ?? 0;
  const hasEnoughMessages = messages.length >= SUMMARY_TRIGGER_MESSAGE_COUNT;

  if (hasEnoughMessages) {
    const archiveUpto = Math.max(0, messages.length - RECENT_MESSAGES_TO_KEEP);
    const mergeFrom = Math.min(summaryArchiveMessageCount, archiveUpto);

    if (archiveUpto > mergeFrom) {
      const summarySource = messages.slice(mergeFrom, archiveUpto);

      if (summarySource.length > 0) {
        memoryState.summary = buildMergedSummary(memoryState.summary, summarySource);
        memoryState.summaryUpdatedAt = Date.now();
        summaryUpdated = true;
        summaryArchiveMessageCount = archiveUpto;
      }
    }
  }

  const promptTokensEstimate = estimateTextTokens(prompt);
  const summaryTokensEstimate = estimateTextTokens(memoryState.summary);
  const budgetTokensEstimate = Math.floor(CONTEXT_WINDOW_TOKENS * INPUT_BUDGET_RATIO) - RESERVED_OUTPUT_TOKENS;
  const maxHistoryBudget = Math.max(0, budgetTokensEstimate - promptTokensEstimate - summaryTokensEstimate);

  const recentHistory = messages.slice(-RECENT_MESSAGES_TO_KEEP);
  const selectedHistory: Message[] = [];
  let selectedHistoryTokens = 0;

  for (let index = recentHistory.length - 1; index >= 0; index -= 1) {
    const message = recentHistory[index];
    const nextTokens = estimateTextTokens(message.content) + 4;

    if (selectedHistoryTokens + nextTokens > maxHistoryBudget) {
      break;
    }

    selectedHistory.unshift(message);
    selectedHistoryTokens += nextTokens;
  }

  const totalInputTokensEstimate = promptTokensEstimate + summaryTokensEstimate + selectedHistoryTokens;

  return {
    history: selectedHistory,
    memorySummary: memoryState.summary,
    summaryUpdated,
    summaryArchiveMessageCount,
    diagnostics: {
      totalInputTokensEstimate,
      budgetTokensEstimate,
      historyTokensEstimate: selectedHistoryTokens,
      summaryTokensEstimate,
      promptTokensEstimate,
    },
  };
};
