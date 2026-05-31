import { mkdir, readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { parseStoredSession } from './normalizeSession.js';
import { SESSION_DATA_DIR } from './sessionPaths.js';
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

export const listRecentDialoguesFromFiles = async (limit: number): Promise<RecentDialogueItem[]> => {
  await mkdir(SESSION_DATA_DIR, { recursive: true });
  const files = await readdir(SESSION_DATA_DIR);
  const jsonFiles = files.filter((file) => file.endsWith('.json'));

  const dialogues = await Promise.all(
    jsonFiles.map(async (file) => {
      const filePath = join(SESSION_DATA_DIR, file);

      try {
        const [raw, fileStat] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);
        const session = parseStoredSession(JSON.parse(raw), fileStat.mtimeMs);
        const sessionId = file.slice(0, -5);
        const parsed = tryParsePublishedPlaygroundStreamSessionId(sessionId);
        const playgroundSurface: PlaygroundHistorySurface = parsed ? 'published' : 'default';
        const basePlaygroundSessionId = parsed?.baseSessionId ?? sessionId;
        const publishedChatbotWorkflowAppId = parsed?.workflowAppId ?? null;

        for (let index = session.messages.length - 1; index >= 0; index -= 1) {
          const message = session.messages[index];
          if (message.role === 'user') {
            return {
              id: sessionId,
              sessionId,
              updatedAt: fileStat.mtimeMs,
              userContent: message.content,
              playgroundSurface,
              basePlaygroundSessionId,
              publishedChatbotWorkflowAppId,
            } satisfies RecentDialogueItem;
          }
        }

        return null;
      } catch {
        console.warn(`[sessionStore] 跳过无法读取的 session 文件: ${file}`);
        return null;
      }
    }),
  );

  return dialogues
    .filter((item): item is RecentDialogueItem => item !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
};
