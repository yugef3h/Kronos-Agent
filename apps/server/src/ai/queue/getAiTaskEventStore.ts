import { getRedisClient } from '../../../infra/redisClient.js';
import type { AiTaskEventStore } from './aiTaskEventStore.js';
import { memoryAiTaskEventStore } from './memoryAiTaskEventStore.js';
import { createRedisAiTaskEventStore } from './redisAiTaskEventStore.js';

let redisStore: AiTaskEventStore | undefined;

const isRedisTaskEventsEnabled = (): boolean =>
  (process.env.AI_TASK_EVENTS_REDIS ?? 'false').trim().toLowerCase() === 'true'
  || process.env.AI_TASK_EVENTS_REDIS === '1'
  || (process.env.AI_TASK_STORE_REDIS ?? 'false').trim().toLowerCase() === 'true';

/** 任务事件 memory / redis */
export const getAiTaskEventStore = (): AiTaskEventStore => {
  if (!isRedisTaskEventsEnabled()) {
    return memoryAiTaskEventStore;
  }

  if (!redisStore) {
    redisStore = createRedisAiTaskEventStore(getRedisClient().duplicate());
  }

  return redisStore;
};
