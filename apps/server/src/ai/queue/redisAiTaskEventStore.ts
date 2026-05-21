import type Redis from 'ioredis';
import type { AiTaskEvent } from './aiTaskEvents.js';
import type { AiTaskEventStore } from './aiTaskEventStore.js';

const EVENT_KEY_PREFIX = 'kronos:ai:task:events:';
const DEFAULT_TTL_SEC = 24 * 60 * 60;

const eventKey = (taskId: string) => `${EVENT_KEY_PREFIX}${taskId}`;

/** Redis 任务事件列表 */
export const createRedisAiTaskEventStore = (redis: Redis, ttlSec = DEFAULT_TTL_SEC): AiTaskEventStore => ({
  async append(taskId, type, data = {}) {
    const rawItems = await redis.lrange(eventKey(taskId), 0, -1);
    const event: AiTaskEvent = {
      id: rawItems.length + 1,
      taskId,
      type,
      data,
      timestamp: Date.now(),
    };
    await redis.rpush(eventKey(taskId), JSON.stringify(event));
    await redis.expire(eventKey(taskId), ttlSec);
    return event;
  },

  async list(taskId, afterId = 0) {
    const rawItems = await redis.lrange(eventKey(taskId), 0, -1);
    const events: AiTaskEvent[] = [];

    for (const raw of rawItems) {
      try {
        const parsed = JSON.parse(raw) as AiTaskEvent;
        if (parsed.id > afterId) {
          events.push(parsed);
        }
      } catch {
        // skip corrupt entry
      }
    }

    return events;
  },

  async clear(taskId) {
    await redis.del(eventKey(taskId));
  },
});
