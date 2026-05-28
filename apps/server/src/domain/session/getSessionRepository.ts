import { getRedisClient } from '../../infra/redisClient.js';
import { FileSessionRepository } from './fileSessionRepository.js';
import { RedisSessionRepository } from './redisSessionRepository.js';
import type { SessionRepository } from './sessionRepository.js';

export type SessionStoreMode = 'file' | 'redis';

export const resolveSessionStoreMode = (): SessionStoreMode => {
  const raw = (process.env.SESSION_STORE ?? 'file').trim().toLowerCase();
  return raw === 'redis' ? 'redis' : 'file';
};

const resolveSessionTtlSec = (): number => {
  const raw = Number(process.env.SESSION_TTL_SEC ?? '604800');
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 604800;
};

let repository: SessionRepository | undefined;
let fileRepository: FileSessionRepository | undefined;

export const getSessionRepository = (): SessionRepository => {
  if (repository) {
    return repository;
  }

  if (resolveSessionStoreMode() === 'redis') {
    repository = new RedisSessionRepository(getRedisClient().duplicate(), resolveSessionTtlSec());
    return repository;
  }

  fileRepository = new FileSessionRepository();
  repository = fileRepository;
  return repository;
};

export const getFileSessionRepositoryOrNull = (): FileSessionRepository | null => fileRepository ?? null;

export const resetSessionRepositoryForTests = (): void => {
  repository = undefined;
  fileRepository = undefined;
};
