import type Redis from 'ioredis';
import type { AiTaskRecord } from '../types/aiTaskRecord.js';
import type { AiTaskStore } from './aiTaskStore.js';
import { randomUUID } from 'node:crypto';

const TASK_KEY_PREFIX = 'kronos:ai:task:';
const TASK_INDEX_KEY = 'kronos:ai:task:index';
const DEFAULT_TTL_SEC = 24 * 60 * 60;

const taskKey = (taskId: string) => `${TASK_KEY_PREFIX}${taskId}`;

/** P3-Q-03: Redis 任务持久化 */
export const createRedisAiTaskStore = (redis: Redis, ttlSec = DEFAULT_TTL_SEC): AiTaskStore => ({
  async create(partial) {
    const now = Date.now();
    const record: AiTaskRecord = {
      taskId: partial.taskId ?? randomUUID(),
      kind: partial.kind,
      priority: partial.priority,
      payload: partial.payload,
      status: 'queued',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };

    await redis.set(taskKey(record.taskId), JSON.stringify(record), 'EX', ttlSec);
    await redis.sadd(TASK_INDEX_KEY, record.taskId);
    return record;
  },

  async get(taskId) {
    const raw = await redis.get(taskKey(taskId));
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AiTaskRecord;
    } catch {
      return null;
    }
  },

  async patch(taskId, patch) {
    const existing = await this.get(taskId);
    if (!existing) {
      return null;
    }

    const updated: AiTaskRecord = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    await redis.set(taskKey(taskId), JSON.stringify(updated), 'EX', ttlSec);
    return updated;
  },

  async listByStatus(status) {
    const ids = await redis.smembers(TASK_INDEX_KEY);
    const records: AiTaskRecord[] = [];

    for (const id of ids) {
      const record = await this.get(id);
      if (record?.status === status) {
        records.push(record);
      }
    }

    return records;
  },
});
