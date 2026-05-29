import type { Redis } from 'ioredis';
import { parseStoredSession } from './normalizeSession.js';
import { SESSION_REDIS_KEY_PREFIX, toSessionRedisKey } from './sessionKeys.js';
import type { PlaygroundHistorySurface, RecentDialogueItem } from './types.js';

const tryParsePublishedPlaygroundStreamSessionId = (
  streamSessionId: string,
): { baseSessionId: string; workflowAppId: string } | null => {
  const marker = '-chatbot-';
  if (!streamSessionId.startsWith('playground-')) {
    return null;
  }

  const markerIndex = streamSessionId.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const baseSessionId = streamSessionId.slice('playground-'.length, markerIndex);
  const workflowAppId = streamSessionId.slice(markerIndex + marker.length);
  if (!baseSessionId || !workflowAppId) {
    return null;
  }

  return { baseSessionId, workflowAppId };
};

const sessionIdFromRedisKey = (key: string): string | null => {
  if (!key.startsWith(SESSION_REDIS_KEY_PREFIX)) {
    return null;
  }

  const sessionId = key.slice(SESSION_REDIS_KEY_PREFIX.length);
  return sessionId.length > 0 ? sessionId : null;
};

const resolveUpdatedAt = (session: ReturnType<typeof parseStoredSession>): number => {
  const messageTimes = session.messages
    .map((message) => message.timestamp)
    .filter((value): value is number => typeof value === 'number');

  if (messageTimes.length > 0) {
    return Math.max(...messageTimes);
  }

  return session.memorySummaryUpdatedAt ?? Date.now();
};

const toDialogueItem = (
  sessionId: string,
  session: ReturnType<typeof parseStoredSession>,
): RecentDialogueItem | null => {
  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    const message = session.messages[index];
    if (message.role !== 'user') {
      continue;
    }

    const parsed = tryParsePublishedPlaygroundStreamSessionId(sessionId);
    const playgroundSurface: PlaygroundHistorySurface = parsed ? 'published' : 'default';

    return {
      id: sessionId,
      sessionId,
      updatedAt: resolveUpdatedAt(session),
      userContent: message.content,
      playgroundSurface,
      basePlaygroundSessionId: parsed?.baseSessionId ?? sessionId,
      publishedChatbotWorkflowAppId: parsed?.workflowAppId ?? null,
    };
  }

  return null;
};

export const listRecentDialoguesFromRedis = async (
  redis: Redis,
  limit: number,
): Promise<RecentDialogueItem[]> => {
  const dialogues: RecentDialogueItem[] = [];
  let cursor = '0';

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      `${SESSION_REDIS_KEY_PREFIX}*`,
      'COUNT',
      100,
    );
    cursor = nextCursor;

    for (const key of keys) {
      const sessionId = sessionIdFromRedisKey(key);
      if (!sessionId) {
        continue;
      }

      try {
        const raw = await redis.get(toSessionRedisKey(sessionId));
        if (!raw) {
          continue;
        }

        const session = parseStoredSession(JSON.parse(raw), Date.now());
        const item = toDialogueItem(sessionId, session);
        if (item) {
          dialogues.push(item);
        }
      } catch {
        console.warn(`[sessionStore:redis] skip unreadable session key: ${key}`);
      }
    }
  } while (cursor !== '0');

  return dialogues
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
};

export const mergeRecentDialogueItems = (
  primary: RecentDialogueItem[],
  secondary: RecentDialogueItem[],
  limit: number,
): RecentDialogueItem[] => {
  const byId = new Map<string, RecentDialogueItem>();

  for (const item of [...primary, ...secondary]) {
    const existing = byId.get(item.sessionId);
    if (!existing || item.updatedAt > existing.updatedAt) {
      byId.set(item.sessionId, item);
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
};
