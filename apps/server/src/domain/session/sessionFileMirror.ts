import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { parseStoredSession } from './normalizeSession.js';
import { SESSION_DATA_DIR } from './sessionPaths.js';
import type { Session } from './types.js';

const sessionFilePath = (sessionId: string): string => join(SESSION_DATA_DIR, `${sessionId}.json`);

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
    await mkdir(SESSION_DATA_DIR, { recursive: true });
    await writeFile(sessionFilePath(sessionId), JSON.stringify(session), 'utf-8');
  } catch (err) {
    console.warn(`[sessionStore] mirror session ${sessionId} to file failed:`, err);
  }
};
