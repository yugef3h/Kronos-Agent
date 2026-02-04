import type { NodeRunStatus, RunError, WorkflowRunStatus } from './types.js'

export type WorkflowRunEventType =
  | 'node_started'
  | 'node_finished'
  | 'workflow_finished'

export type WorkflowRunEvent = {
  type: WorkflowRunEventType
  runId: string
  timestamp: number
  nodeId?: string
  status?: NodeRunStatus | WorkflowRunStatus
  iterationIndex?: number
  error?: RunError
}

const eventsByRunId = new Map<string, WorkflowRunEvent[]>()

export const appendWorkflowRunEvent = (event: WorkflowRunEvent): void => {
  const events = eventsByRunId.get(event.runId) ?? []
  events.push(event)
  eventsByRunId.set(event.runId, events)
}

export const listWorkflowRunEvents = (runId: string): WorkflowRunEvent[] =>
  [...(eventsByRunId.get(runId) ?? [])]

export const clearWorkflowRunEvents = (runId: string): void => {
  eventsByRunId.delete(runId)
}

export const formatWorkflowRunEventSse = (event: WorkflowRunEvent): string =>
  `data: ${JSON.stringify(event)}\n\n`
