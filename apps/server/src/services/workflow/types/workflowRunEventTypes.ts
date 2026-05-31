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

export const formatWorkflowRunEventSse = (event: WorkflowRunEvent): string =>
  `data: ${JSON.stringify(event)}\n\n`
