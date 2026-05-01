import {
  CONTEXT_WINDOW_TOKENS,
  INPUT_BUDGET_RATIO,
  RESERVED_OUTPUT_TOKENS,
  SUMMARY_TRIGGER_MESSAGE_COUNT,
} from '../memory/constants.js';
import { estimateTextTokens } from '../memory/tokenEstimate.js';
import {
  getFileSessionRepositoryOrNull,
  getSessionRepository,
  initSessionRepository,
  resolveSessionStoreMode,
} from './session/getSessionRepository.js';
import { duplicateRedisClient } from '../infra/redisClient.js';
import {
  listRecentDialoguesFromFiles,
} from './session/listRecentDialogues.js';
import {
  listRecentDialoguesFromRedis,
  mergeRecentDialogueItems,
} from './session/listRecentDialoguesFromRedis.js';
import { createEmptySession } from './session/normalizeSession.js';
import {
  recordSessionLoad,
  recordSessionSaveConflict,
  recordSessionSaveSuccess,
} from './session/sessionMetrics.js';
import { SessionConflictError } from './session/sessionConflictError.js';
import { enqueueSessionSave, flushSessionSaveQueue } from './session/sessionWriteQueue.js';
import type {
  AttachmentMeta,
  Message,
  RecentDialogueItem,
  Session,
  SessionAppendMessage,
} from './session/types.js';

export type {
  AttachmentMeta,
  Message,
  RecentDialogueItem,
  Session,
  SessionAppendMessage,
};

export { SessionConflictError } from './session/sessionConflictError.js';
export { SessionStreamLockBusyError } from './session/sessionStreamLock.js';
export { resolveSessionStoreMode } from './session/getSessionRepository.js';
export { getSessionMetrics } from './session/sessionMetrics.js';

export const initSessionStore = async (): Promise<void> => {
  await initSessionRepository();
};

export const loadSession = async (sessionId: string): Promise<Session> => {
  recordSessionLoad();
  return getSessionRepository().load(sessionId);
};

export const saveSession = async (sessionId: string, session: Session): Promise<Session> => {
  try {
    const saved = await getSessionRepository().save(sessionId, session, {
      expectedVersion: session.version,
    });
    session.version = saved.version;
    session.messages = saved.messages;
    recordSessionSaveSuccess();
    return saved;
  } catch (error) {
    if (error instanceof SessionConflictError) {
      recordSessionSaveConflict({
        sessionId: error.sessionId,
        expectedVersion: error.expectedVersion,
        actualVersion: error.actualVersion,
      });
    }

    throw error;
  }
};

/** 同 session 串行异步落盘，不阻塞 SSE 主流程。 */
export const saveSessionAsync = (sessionId: string, session: Session): void => {
  enqueueSessionSave(sessionId, session, saveSession);
};

export const waitForSessionPersist = async (sessionId: string): Promise<void> => {
  await flushSessionSaveQueue(sessionId);
};

/** @deprecated 仅 `SESSION_STORE=file` 时同步读内存；Redis 模式请用 `loadSession` */
export const getSession = (sessionId: string): Session => {
  if (resolveSessionStoreMode() === 'redis') {
    throw new Error('getSession() is unavailable when SESSION_STORE=redis; use loadSession()');
  }

  const fileRepo = getFileSessionRepositoryOrNull();
  if (!fileRepo) {
    return createEmptySession();
  }

  return fileRepo.getSessionSync(sessionId);
};

export const persistSession = (sessionId: string, session: Session): void => {
  saveSessionAsync(sessionId, session);
};

export const listMessages = async (sessionId: string): Promise<Message[]> =>
  (await loadSession(sessionId)).messages;

export const listRecentDialogues = async (limit = 10): Promise<RecentDialogueItem[]> => {
  try {
    const capped = Math.min(Math.max(Math.floor(limit), 1), 50);
    const fileItems = await listRecentDialoguesFromFiles(capped * 2);

    if (resolveSessionStoreMode() !== 'redis') {
      return fileItems.slice(0, capped);
    }

    const redis = duplicateRedisClient();
    try {
      const redisItems = await listRecentDialoguesFromRedis(redis, capped * 2);
      return mergeRecentDialogueItems(fileItems, redisItems, capped);
    } finally {
      redis.disconnect();
    }
  } catch (err) {
    console.warn('[sessionStore] listRecentDialogues 失败:', err);
    return [];
  }
};

export const getSessionSnapshot = async (sessionId: string) => {
  const session = await loadSession(sessionId);
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

export const appendSessionMessages = async (params: {
  sessionId: string;
  messages: SessionAppendMessage[];
}): Promise<void> => {
  const session = await loadSession(params.sessionId);
  const now = Date.now();

  const nextMessages = params.messages
    .map((message, index) => ({
      role: message.role,
      content: message.content.trim(),
      timestamp: now + index,
      attachments: message.attachments,
    }))
    .filter((message) => message.content.length > 0 || (message.attachments && message.attachments.length > 0));

  if (nextMessages.length === 0) {
    return;
  }

  session.messages.push(...nextMessages);
  session.lastId += nextMessages.length;

  await saveSession(params.sessionId, session);
};
