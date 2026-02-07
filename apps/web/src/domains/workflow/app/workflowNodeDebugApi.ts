import { apiUrl } from '../../../lib/api'
import type { NodeRunningStatus } from '../editor/types/common'
import type { RunError, WorkflowRunSummary } from '../editor/types/run'
import { parseWorkflowRunApiError } from './workflowRunApi'

export const WORKFLOW_NODE_DEBUG_PATH = '/api/workflow/debug/node'

export const NODE_DEBUG_EXECUTOR_NOT_FOUND_CODE = 'node_debug_executor_not_found'

export type NodeDebugBlockKind =
  | 'start'
  | 'end'
  | 'llm'
  | 'if-else'
  | 'knowledge-retrieval'
  | 'loop'
  | 'iteration'

export type NodeDebugNodePayload = {
  id: string
  type: NodeDebugBlockKind
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  data?: Record<string, unknown>
}

export type NodeDebugRequest = {
  appId?: string
  node: NodeDebugNodePayload
  inputs?: Record<string, unknown>
  context?: {
    variables?: Record<string, unknown>
  }
}

export type NodeDebugResult = {
  nodeId: string
  status: NodeRunningStatus
  startedAt: number
  finishedAt: number
  elapsedMs: number
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  error?: RunError
}

export type NodeDebugRunSnapshot = {
  nodeId: string
  nodeType: NodeDebugBlockKind
  status: NodeRunningStatus
  startedAt: number
  finishedAt: number
  elapsedMs: number
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  error?: RunError
}

export type DebugWorkflowNodeResponse = {
  result: NodeDebugResult
  run?: WorkflowRunSummary & {
    nodeDebug?: NodeDebugRunSnapshot
  }
}

export class WorkflowNodeDebugApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'WorkflowNodeDebugApiError'
    this.status = status
    this.code = code
  }
}

export const debugWorkflowNode = async (
  request: NodeDebugRequest,
): Promise<DebugWorkflowNodeResponse> => {
  const response = await fetch(apiUrl(WORKFLOW_NODE_DEBUG_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const parsed = await parseWorkflowRunApiError(response, 'Node debug request failed')
    throw new WorkflowNodeDebugApiError(parsed.message, parsed.status, parsed.code)
  }

  return await response.json() as DebugWorkflowNodeResponse
}

export const isNodeDebugExecutorNotFoundError = (error: unknown): boolean =>
  error instanceof WorkflowNodeDebugApiError
  && error.code === NODE_DEBUG_EXECUTOR_NOT_FOUND_CODE
