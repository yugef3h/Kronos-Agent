import type { WorkflowRunEvent } from '../types/workflowRunEventTypes.js'

export type WorkflowRunEventsBackend = {
  append: (event: WorkflowRunEvent) => Promise<void>
  list: (runId: string) => Promise<WorkflowRunEvent[]>
  clear: (runId: string) => Promise<void>
}
