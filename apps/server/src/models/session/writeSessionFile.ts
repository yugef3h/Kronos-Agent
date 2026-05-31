import { mkdir, rename, writeFile } from 'fs/promises';
import { join } from 'path';
import { SESSION_DATA_DIR } from './sessionPaths.js';
import type { Session } from './types.js';

export const sessionFilePath = (sessionId: string): string =>
  join(SESSION_DATA_DIR, `${sessionId}.json`);

const sessionTempFilePath = (sessionId: string): string =>
  join(SESSION_DATA_DIR, `${sessionId}.json.tmp`);

const writeQueues = new Map<string, Promise<void>>();

/** 同 session 串行落盘；先写 tmp 再 rename，避免并发/中断导致 JSON 损坏。 */
export const writeSessionFile = async (sessionId: string, session: Session): Promise<void> => {
  const previous = writeQueues.get(sessionId) ?? Promise.resolve();

  const current = previous
    .then(async () => {
      await mkdir(SESSION_DATA_DIR, { recursive: true });
      const tmpPath = sessionTempFilePath(sessionId);
      const finalPath = sessionFilePath(sessionId);
      await writeFile(tmpPath, JSON.stringify(session), 'utf-8');
      await rename(tmpPath, finalPath);
    })
    .finally(() => {
      if (writeQueues.get(sessionId) === current) {
        writeQueues.delete(sessionId);
      }
    });

  writeQueues.set(sessionId, current);
  await current;
};
