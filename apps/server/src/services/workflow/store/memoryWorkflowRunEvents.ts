import type { WorkflowRunEvent } from './workflowRunEventTypes.js'
import type { WorkflowRunEventsBackend } from './workflowRunEventsBackend.js'

const eventsByRunId = new Map<string, WorkflowRunEvent[]>()

export class MemoryWorkflowRunEvents implements WorkflowRunEventsBackend {
  async append(event: WorkflowRunEvent): Promise<void> {
    const events = eventsByRunId.get(event.runId) ?? []
    events.push(event)
    eventsByRunId.set(event.runId, events)
  }

  async list(runId: string): Promise<WorkflowRunEvent[]> {
    return [...(eventsByRunId.get(runId) ?? [])]
  }

  async clear(runId: string): Promise<void> {
    eventsByRunId.delete(runId)
  }
}
