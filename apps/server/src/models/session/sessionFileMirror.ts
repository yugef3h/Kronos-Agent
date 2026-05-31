import { readFile } from 'fs/promises';
import { parseStoredSession } from './normalizeSession.js';
import { sessionFilePath, writeSessionFile } from './writeSessionFile.js';
import type { Session } from './types.js';

export const readSessionFromFile = async (sessionId: string): Promise<Session | null> => {
  try {
    const raw = await readFile(sessionFilePath(sessionId), 'utf-8');
    return parseStoredSession(JSON.parse(raw), Date.now());
  } catch {
    return null;
  }
};

/** Redis 主存时异步镜像到 json，保证历史不丢、recent 列表仍可用。 */
export const mirrorSessionToFile = async (sessionId: string, session: Session): Promise<void> => {
  try {
    await writeSessionFile(sessionId, session);
  } catch (err) {
    console.warn(`[sessionStore] mirror session ${sessionId} to file failed:`, err);
  }
};
