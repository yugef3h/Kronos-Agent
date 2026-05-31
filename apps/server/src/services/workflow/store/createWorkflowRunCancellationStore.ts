import { getRedisClient } from '../../infra/redisClient.js'
import { MemoryWorkflowRunCancellation } from './memoryWorkflowRunCancellation.js'
import { RedisWorkflowRunCancellation } from './redisWorkflowRunCancellation.js'
import type { WorkflowRunCancellationBackend } from './workflowRunCancellationBackend.js'

let singleton: WorkflowRunCancellationBackend | undefined

const resolveWorkflowRunCancelStoreMode = (): 'memory' | 'redis' => {
  const raw = (process.env.WORKFLOW_RUN_STORE ?? 'memory').trim().toLowerCase()
  return raw === 'redis' ? 'redis' : 'memory'
}

export const createWorkflowRunCancellationStore = (): WorkflowRunCancellationBackend => {
  if (resolveWorkflowRunCancelStoreMode() === 'redis') {
    return new RedisWorkflowRunCancellation(getRedisClient())
  }

  return new MemoryWorkflowRunCancellation()
}

export const getWorkflowRunCancellationStore = (): WorkflowRunCancellationBackend =>
  singleton ?? (singleton = createWorkflowRunCancellationStore())
