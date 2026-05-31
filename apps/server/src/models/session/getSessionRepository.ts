import { closeRedisClient, duplicateRedisClient, getRedisClient } from '../infra/redisClient.js';
import { FileSessionRepository } from './fileSessionRepository.js';
import { RedisSessionRepository } from './redisSessionRepository.js';
import type { SessionRepository } from './sessionRepository.js';

export type SessionStoreMode = 'file' | 'redis';

const resolveConfiguredSessionStoreMode = (): SessionStoreMode => {
  const raw = (process.env.SESSION_STORE ?? 'file').trim().toLowerCase();
  return raw === 'redis' ? 'redis' : 'file';
};

const resolveSessionTtlSec = (): number => {
  const raw = Number(process.env.SESSION_TTL_SEC ?? '604800');
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 604800;
};

let repository: SessionRepository | undefined;
let fileRepository: FileSessionRepository | undefined;
let effectiveMode: SessionStoreMode | undefined;

/** 运行时实际模式（Redis 不可达时可能从 redis 降为 file） */
export const resolveSessionStoreMode = (): SessionStoreMode => {
  if (effectiveMode) {
    return effectiveMode;
  }

  return resolveConfiguredSessionStoreMode();
};

export const initSessionRepository = async (): Promise<void> => {
  if (repository) {
    await repository.init();
    return;
  }

  if (resolveConfiguredSessionStoreMode() === 'redis') {
    try {
      const redis = getRedisClient();
      await redis.ping();
      repository = new RedisSessionRepository(duplicateRedisClient(), resolveSessionTtlSec());
      effectiveMode = 'redis';
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      await closeRedisClient().catch(() => undefined);
      console.warn(
        `[sessionStore] Redis unavailable (${reason}); fallback to file. ` +
          'Start Redis or set SESSION_STORE=file in .env for local dev.',
      );
      fileRepository = new FileSessionRepository();
      repository = fileRepository;
      effectiveMode = 'file';
    }
  } else {
    fileRepository = new FileSessionRepository();
    repository = fileRepository;
    effectiveMode = 'file';
  }

  await repository.init();
};

export const getSessionRepository = (): SessionRepository => {
  if (repository) {
    return repository;
  }

  fileRepository = new FileSessionRepository();
  repository = fileRepository;
  effectiveMode = 'file';
  return repository;
};

export const getFileSessionRepositoryOrNull = (): FileSessionRepository | null => fileRepository ?? null;

export const resetSessionRepositoryForTests = (): void => {
  repository = undefined;
  fileRepository = undefined;
  effectiveMode = undefined;
};
