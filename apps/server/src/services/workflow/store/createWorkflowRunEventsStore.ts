import { getRedisClient } from '../../infra/redisClient.js'
import { MemoryWorkflowRunEvents } from './memoryWorkflowRunEvents.js'
import { RedisWorkflowRunEvents } from './redisWorkflowRunEvents.js'
import type { WorkflowRunEventsBackend } from './workflowRunEventsBackend.js'

let singleton: WorkflowRunEventsBackend | undefined

const resolveWorkflowRunEventsStoreMode = (): 'memory' | 'redis' => {
  const raw = (process.env.WORKFLOW_RUN_EVENTS_STORE ?? 'memory').trim().toLowerCase()
  return raw === 'redis' ? 'redis' : 'memory'
}

export const createWorkflowRunEventsStore = (): WorkflowRunEventsBackend => {
  if (resolveWorkflowRunEventsStoreMode() === 'redis') {
    return new RedisWorkflowRunEvents(getRedisClient())
  }

  return new MemoryWorkflowRunEvents()
}

export const getWorkflowRunEventsStore = (): WorkflowRunEventsBackend => {
  if (!singleton) {
    singleton = createWorkflowRunEventsStore()
  }

  return singleton
}
