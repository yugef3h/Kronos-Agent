import { duplicateRedisClient } from '../infra/redisClient.js';
import { resolveSessionStoreMode } from './getSessionRepository.js';

const LOCK_KEY_PREFIX = 'kronos:session:lock:';
const DEFAULT_LOCK_TTL_SEC = 120;

export class SessionStreamLockBusyError extends Error {
  readonly code = 'SESSION_STREAM_BUSY';

  constructor(readonly sessionId: string) {
    super(`Session ${sessionId} is locked by another stream`);
    this.name = 'SessionStreamLockBusyError';
  }
}

const resolveLockTtlSec = (): number => {
  const raw = Number(process.env.SESSION_STREAM_LOCK_TTL_SEC ?? DEFAULT_LOCK_TTL_SEC);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_LOCK_TTL_SEC;
};

const isStreamLockEnabled = (): boolean => {
  if (resolveSessionStoreMode() !== 'redis') {
    return false;
  }

  const raw = (process.env.SESSION_STREAM_LOCK ?? 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'no';
};

/** Redis 模式下串行同 session 的 SSE，避免双开流写冲突。 */
export const acquireSessionStreamLock = async (
  sessionId: string,
): Promise<(() => Promise<void>) | null> => {
  if (!isStreamLockEnabled()) {
    return null;
  }

  const redis = duplicateRedisClient();
  const key = `${LOCK_KEY_PREFIX}${sessionId}`;
  const token = `${process.pid}-${Date.now()}`;
  const acquired = await redis.set(key, token, 'EX', resolveLockTtlSec(), 'NX');

  if (acquired !== 'OK') {
    redis.disconnect();
    throw new SessionStreamLockBusyError(sessionId);
  }

  return async () => {
    try {
      const current = await redis.get(key);
      if (current === token) {
        await redis.del(key);
      }
    } finally {
      redis.disconnect();
    }
  };
};
