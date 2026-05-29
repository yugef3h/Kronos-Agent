import type { Redis } from 'ioredis';
import { SessionConflictError } from './sessionConflictError.js';
import { migrateSessionFilesToRedis } from './migrateSessionFilesToRedis.js';
import { createEmptySession, normalizeSession, parseStoredSession } from './normalizeSession.js';
import { mirrorSessionToFile, readSessionFromFile } from './sessionFileMirror.js';
import { toSessionRedisKey } from './sessionKeys.js';
import type { SaveSessionOptions, SessionRepository } from './sessionRepository.js';
import type { Session } from './types.js';

const MAX_SAVE_RETRIES = 3;

const isFileMirrorEnabled = (): boolean => {
  const raw = (process.env.SESSION_FILE_MIRROR ?? 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'no';
};

export class RedisSessionRepository implements SessionRepository {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSec: number,
  ) {}

  async init(): Promise<void> {
    try {
      await this.redis.ping();
      console.warn('[sessionStore:redis] connected');
      await migrateSessionFilesToRedis(this.redis, this.ttlSec);
    } catch (err) {
      console.warn('[sessionStore:redis] ping/migrate failed:', err);
    }
  }

  async load(sessionId: string): Promise<Session> {
    const key = toSessionRedisKey(sessionId);
    const raw = await this.redis.get(key);

    if (raw) {
      try {
        return parseStoredSession(JSON.parse(raw), Date.now());
      } catch {
        return createEmptySession();
      }
    }

    const fromFile = await readSessionFromFile(sessionId);
    if (!fromFile || (fromFile.messages.length === 0 && !fromFile.memorySummary.trim())) {
      return createEmptySession();
    }

    void this.save(sessionId, fromFile, { expectedVersion: fromFile.version }).catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : 'unknown error';
      console.warn(`[sessionStore:redis] lazy migrate ${sessionId} failed: ${reason}`);
    });

    return { ...fromFile, messages: [...fromFile.messages] };
  }

  async save(
    sessionId: string,
    session: Session,
    options: SaveSessionOptions = {},
  ): Promise<Session> {
    const key = toSessionRedisKey(sessionId);
    const expectedVersion = options.expectedVersion ?? session.version;

    for (let attempt = 0; attempt < MAX_SAVE_RETRIES; attempt += 1) {
      await this.redis.watch(key);
      const raw = await this.redis.get(key);
      const current = raw ? parseStoredSession(JSON.parse(raw), Date.now()) : createEmptySession();

      if (expectedVersion !== current.version) {
        await this.redis.unwatch();
        throw new SessionConflictError(sessionId, expectedVersion, current.version);
      }

      const next = normalizeSession(
        {
          ...session,
          version: current.version + 1,
        },
        Date.now(),
      );

      const multi = this.redis.multi();
      multi.set(key, JSON.stringify(next), 'EX', this.ttlSec);
      const execResult = await multi.exec();

      if (execResult) {
        if (isFileMirrorEnabled()) {
          void mirrorSessionToFile(sessionId, next);
        }

        return { ...next, messages: [...next.messages] };
      }
    }

    throw new SessionConflictError(sessionId, expectedVersion, -1);
  }
}
