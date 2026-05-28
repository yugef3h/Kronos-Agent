import type { Session } from './types.js';

export const normalizeSession = (session: Session, baseTimestamp: number): Session => {
  const normalizedMessages = session.messages.map((message, index) => ({
    ...message,
    timestamp: typeof message.timestamp === 'number' ? message.timestamp : baseTimestamp + index,
  }));

  return {
    ...session,
    version: typeof session.version === 'number' ? session.version : 0,
    messages: normalizedMessages,
  };
};

export const parseStoredSession = (raw: unknown, baseTimestamp: number): Session => {
  const data = typeof raw === 'object' && raw !== null ? (raw as Session) : ({} as Session);

  return normalizeSession(
    {
      version: typeof data.version === 'number' ? data.version : 0,
      lastId: typeof data.lastId === 'number' ? data.lastId : 0,
      messages: Array.isArray(data.messages) ? data.messages : [],
      memorySummary: typeof data.memorySummary === 'string' ? data.memorySummary : '',
      memorySummaryUpdatedAt:
        typeof data.memorySummaryUpdatedAt === 'number' ? data.memorySummaryUpdatedAt : null,
      summaryArchiveMessageCount:
        typeof data.summaryArchiveMessageCount === 'number' ? data.summaryArchiveMessageCount : 0,
    },
    baseTimestamp,
  );
};

export const createEmptySession = (): Session => ({
  version: 0,
  lastId: 0,
  messages: [],
  memorySummary: '',
  memorySummaryUpdatedAt: null,
  summaryArchiveMessageCount: 0,
});
