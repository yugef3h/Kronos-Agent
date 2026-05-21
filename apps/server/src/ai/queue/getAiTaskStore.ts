import { getRedisClient } from '../../infra/redisClient.js';
import type { AiTaskStore } from './aiTaskStore.js';
import {
  createAiTask as memoryCreateAiTask,
  getAiTask as memoryGetAiTask,
  listAiTasksByStatus as memoryListAiTasksByStatus,
  patchAiTask as memoryPatchAiTask,
} from './memoryAiTaskStore.js';
import { createRedisAiTaskStore } from './redisAiTaskStore.js';

let redisStore: AiTaskStore | undefined;

const isRedisTaskStoreEnabled = (): boolean =>
  (process.env.AI_TASK_STORE_REDIS ?? 'false').trim().toLowerCase() === 'true'
  || process.env.AI_TASK_STORE_REDIS === '1';

const memoryStore: AiTaskStore = {
  create: async (partial) => memoryCreateAiTask(partial),
  get: memoryGetAiTask,
  patch: memoryPatchAiTask,
  listByStatus: memoryListAiTasksByStatus,
};

/** P3-Q-02: 按 env 选择任务存储 */
export const getAiTaskStore = (): AiTaskStore => {
  if (!isRedisTaskStoreEnabled()) {
    return memoryStore;
  }

  if (!redisStore) {
    redisStore = createRedisAiTaskStore(getRedisClient().duplicate());
  }

  return redisStore;
};
