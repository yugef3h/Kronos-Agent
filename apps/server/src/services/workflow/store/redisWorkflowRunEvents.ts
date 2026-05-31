import type { Redis } from 'ioredis'
import { DEFAULT_WORKFLOW_RUN_TTL_MS } from '../store/memoryWorkflowRunStore.js'
import type { WorkflowRunEvent } from '../types/workflowRunEventTypes.js'
import type { WorkflowRunEventsBackend } from './workflowRunEventsBackend.js'

const EVENTS_KEY_PREFIX = 'kronos:wf:events:'

const eventsKey = (runId: string) => `${EVENTS_KEY_PREFIX}${runId}`

const expireSeconds = (ttlMs = DEFAULT_WORKFLOW_RUN_TTL_MS) =>
  Math.max(1, Math.ceil(ttlMs / 1000))

export class RedisWorkflowRunEvents implements WorkflowRunEventsBackend {
  constructor(private readonly redis: Redis) {}

  async append(event: WorkflowRunEvent): Promise<void> {
    const key = eventsKey(event.runId)
    await this.redis.rpush(key, JSON.stringify(event))
    await this.redis.expire(key, expireSeconds())
  }

  async list(runId: string): Promise<WorkflowRunEvent[]> {
    const rawItems = await this.redis.lrange(eventsKey(runId), 0, -1)
    return rawItems.map((raw: string) => JSON.parse(raw) as WorkflowRunEvent)
  }

  async clear(runId: string): Promise<void> {
    await this.redis.del(eventsKey(runId))
  }
}
