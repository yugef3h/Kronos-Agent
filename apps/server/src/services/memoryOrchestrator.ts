import type { Message } from '../domain/sessionStore.js';

export const APPROX_TOKEN_PER_CHAR = 1 / 3.8;
export const MAX_SUMMARY_CHARS = 1200;
export const SUMMARY_TRIGGER_MESSAGE_COUNT = 12;
export const RECENT_MESSAGES_TO_KEEP = 8;
export const CONTEXT_WINDOW_TOKENS = 32000;
export const INPUT_BUDGET_RATIO = 0.6;
export const RESERVED_OUTPUT_TOKENS = 1200;

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

export const estimateTextTokens = (text: string): number => {
  if (!text.trim()) {
    return 0;
  }

  return Math.max(1, Math.ceil(text.length * APPROX_TOKEN_PER_CHAR));
};

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

const buildMergedSummary = (existingSummary: string, historyToSummarize: Message[]): string => {
  const lines = historyToSummarize.map(formatMessageLine);
  const recentDigest = trimToMaxChars(lines.join('\n'), 900);
  const merged = existingSummary.trim().length
    ? `已有摘要:\n${existingSummary.trim()}\n\n新增对话摘要:\n${recentDigest}`
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
  const hasEnoughMessages = messages.length >= SUMMARY_TRIGGER_MESSAGE_COUNT;

  if (hasEnoughMessages) {
    const summarizeUntil = Math.max(0, messages.length - RECENT_MESSAGES_TO_KEEP);
    const summarySource = messages.slice(0, summarizeUntil);

    if (summarySource.length > 0) {
      memoryState.summary = buildMergedSummary(memoryState.summary, summarySource);
      memoryState.summaryUpdatedAt = Date.now();
      summaryUpdated = true;
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
    diagnostics: {
      totalInputTokensEstimate,
      budgetTokensEstimate,
      historyTokensEstimate: selectedHistoryTokens,
      summaryTokensEstimate,
      promptTokensEstimate,
    },
  };
};