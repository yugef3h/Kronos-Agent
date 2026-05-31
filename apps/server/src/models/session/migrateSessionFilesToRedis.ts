import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import type { Redis } from 'ioredis';
import { parseStoredSession } from './normalizeSession.js';
import { SESSION_DATA_DIR } from './sessionPaths.js';
import { toSessionRedisKey } from './sessionKeys.js';

/** 启动时把已有 json 会话迁入 Redis（仅 SET NX，不覆盖已有 key）。 */
export const migrateSessionFilesToRedis = async (
  redis: Redis,
  ttlSec: number,
): Promise<number> => {
  let migrated = 0;

  try {
    const files = await readdir(SESSION_DATA_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const sessionId = file.slice(0, -5);
      const key = toSessionRedisKey(sessionId);
      if (await redis.exists(key)) {
        continue;
      }

      try {
        const filePath = join(SESSION_DATA_DIR, file);
        const [raw, fileStat] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);
        const session = parseStoredSession(JSON.parse(raw), fileStat.mtimeMs);
        await redis.set(key, JSON.stringify(session), 'EX', ttlSec);
        migrated += 1;
      } catch {
        console.warn(`[sessionStore:redis] skip corrupt session file during migrate: ${file}`);
      }
    }
  } catch (err) {
    console.warn('[sessionStore:redis] file migration scan failed:', err);
  }

  if (migrated > 0) {
    console.warn(`[sessionStore:redis] migrated ${migrated} sessions from file to redis`);
  }

  return migrated;
};
