import { MemoryWorkflowRunEvents } from './memoryWorkflowRunEvents.js'
import type { WorkflowRunEventsBackend } from './workflowRunEventsBackend.js'

let singleton: WorkflowRunEventsBackend | undefined

const resolveWorkflowRunEventsStoreMode = (): 'memory' | 'redis' => {
  const raw = (process.env.WORKFLOW_RUN_EVENTS_STORE ?? 'memory').trim().toLowerCase()
  return raw === 'redis' ? 'redis' : 'memory'
}

export const createWorkflowRunEventsStore = (): WorkflowRunEventsBackend => {
  if (resolveWorkflowRunEventsStoreMode() === 'redis') {
    throw new Error(
      'WORKFLOW_RUN_EVENTS_STORE=redis is not wired yet. Use memory for local dev.',
    )
  }

  return new MemoryWorkflowRunEvents()
}

export const getWorkflowRunEventsStore = (): WorkflowRunEventsBackend => {
  if (!singleton) {
    singleton = createWorkflowRunEventsStore()
  }

  return singleton
}
