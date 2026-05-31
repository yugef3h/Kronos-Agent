import { getRedisClient } from '../../../infra/redisClient.js'
import { WorkflowRunStore } from '../store/memoryWorkflowRunStore.js'
import { toAsyncWorkflowRunStore } from './memoryWorkflowRunStoreAsync.js'
import { RedisWorkflowRunStore } from '../store/redisWorkflowRunStore.js'
import type { WorkflowRunStoreBackend } from './workflowRunStoreBackend.js'

let singleton: WorkflowRunStoreBackend | undefined

const resolveWorkflowRunStoreMode = (): 'memory' | 'redis' => {
  const raw = (process.env.WORKFLOW_RUN_STORE ?? 'memory').trim().toLowerCase()
  return raw === 'redis' ? 'redis' : 'memory'
}

export const createWorkflowRunStore = (): WorkflowRunStoreBackend => {
  if (resolveWorkflowRunStoreMode() === 'redis') {
    return new RedisWorkflowRunStore(getRedisClient())
  }

  return toAsyncWorkflowRunStore(new WorkflowRunStore())
}

export const getWorkflowRunStore = (): WorkflowRunStoreBackend => {
  if (!singleton) {
    singleton = createWorkflowRunStore()
  }

  return singleton
}
