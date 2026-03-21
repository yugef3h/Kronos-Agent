import type Redis from 'ioredis'
import { DEFAULT_WORKFLOW_RUN_TTL_MS } from './memoryWorkflowRunStore.js'
import type { WorkflowRunCancellationBackend } from './workflowRunCancellationBackend.js'

const CANCEL_KEY_PREFIX = 'kronos:wf:cancel:'

const cancelKey = (runId: string) => `${CANCEL_KEY_PREFIX}${runId}`

const expireSeconds = () =>
  Math.max(1, Math.ceil(DEFAULT_WORKFLOW_RUN_TTL_MS / 1000))

export class RedisWorkflowRunCancellation implements WorkflowRunCancellationBackend {
  constructor(private readonly redis: Redis) {}

  async markCancelled(runId: string): Promise<void> {
    await this.redis.set(cancelKey(runId), '1', 'EX', expireSeconds())
  }

  async isCancelled(runId: string): Promise<boolean> {
    return (await this.redis.exists(cancelKey(runId))) === 1
  }

  async clear(runId: string): Promise<void> {
    await this.redis.del(cancelKey(runId))
  }
}
