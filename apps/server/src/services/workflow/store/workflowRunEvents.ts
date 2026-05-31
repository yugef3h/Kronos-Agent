export type {
  WorkflowRunEvent,
  WorkflowRunEventType,
} from '../types/workflowRunEventTypes.js'
export { formatWorkflowRunEventSse } from '../types/workflowRunEventTypes.js'
export type { WorkflowRunEventsBackend } from './workflowRunEventsBackend.js'
export { createWorkflowRunEventsStore, getWorkflowRunEventsStore } from '../store/createWorkflowRunEventsStore.js'
import { getWorkflowRunEventsStore } from '../store/createWorkflowRunEventsStore.js'
import type { WorkflowRunEvent } from '../types/workflowRunEventTypes.js'

const store = () => getWorkflowRunEventsStore()

export const appendWorkflowRunEvent = async (event: WorkflowRunEvent): Promise<void> => {
  await store().append(event)
}

export const listWorkflowRunEvents = async (runId: string): Promise<WorkflowRunEvent[]> =>
  store().list(runId)

export const clearWorkflowRunEvents = async (runId: string): Promise<void> => {
  await store().clear(runId)
}
