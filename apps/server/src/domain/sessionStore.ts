import {
  CONTEXT_WINDOW_TOKENS,
  INPUT_BUDGET_RATIO,
  RESERVED_OUTPUT_TOKENS,
  SUMMARY_TRIGGER_MESSAGE_COUNT,
  estimateTextTokens,
} from '../services/memoryOrchestrator.js';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type Session = {
  lastId: number;
  messages: Message[];
  memorySummary: string;
  memorySummaryUpdatedAt: number | null;
};

const sessions = new Map<string, Session>();

export const getSession = (sessionId: string): Session => {
  const existing = sessions.get(sessionId);
  if (existing) return existing;

  const created: Session = {
    lastId: 0,
    messages: [],
    memorySummary: '',
    memorySummaryUpdatedAt: null,
  };
  sessions.set(sessionId, created);
  return created;
};

export const listMessages = (sessionId: string): Message[] => getSession(sessionId).messages;

export const getSessionSnapshot = (sessionId: string) => {
  const session = getSession(sessionId);
  const messageCount = session.messages.length;
  const summaryTokensEstimate = estimateTextTokens(session.memorySummary);
  const conversationTokensEstimate = session.messages.reduce(
    (sum, message) => sum + estimateTextTokens(message.content) + 4,
    0,
  );
  const budgetTokensEstimate = Math.floor(CONTEXT_WINDOW_TOKENS * INPUT_BUDGET_RATIO) - RESERVED_OUTPUT_TOKENS;
  const isSummaryThresholdReached = messageCount >= SUMMARY_TRIGGER_MESSAGE_COUNT;

  return {
    messages: session.messages,
    memorySummary: session.memorySummary,
    memorySummaryUpdatedAt: session.memorySummaryUpdatedAt,
    lastId: session.lastId,
    memoryMetrics: {
      messageCount,
      conversationTokensEstimate,
      summaryTokensEstimate,
      budgetTokensEstimate,
      summaryTriggerMessageCount: SUMMARY_TRIGGER_MESSAGE_COUNT,
      isSummaryThresholdReached,
    },
  };
};
