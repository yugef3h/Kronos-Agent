export type {
  WorkflowRunEvent,
  WorkflowRunEventType,
} from './workflowRunEventTypes.js'
export { formatWorkflowRunEventSse } from './workflowRunEventTypes.js'
export type { WorkflowRunEventsBackend } from './workflowRunEventsBackend.js'
export { createWorkflowRunEventsStore, getWorkflowRunEventsStore } from './createWorkflowRunEventsStore.js'
import { getWorkflowRunEventsStore } from './createWorkflowRunEventsStore.js'
import type { WorkflowRunEvent } from './workflowRunEventTypes.js'

const store = () => getWorkflowRunEventsStore()

export const appendWorkflowRunEvent = async (event: WorkflowRunEvent): Promise<void> => {
  await store().append(event)
}

export const listWorkflowRunEvents = async (runId: string): Promise<WorkflowRunEvent[]> =>
  store().list(runId)

export const clearWorkflowRunEvents = async (runId: string): Promise<void> => {
  await store().clear(runId)
}
