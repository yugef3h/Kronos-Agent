import type { NodeExecutionResult } from './nodeExecutors.js'
import type { NodeDebugResult } from './types.js'
import type { NodeRunStatus, RunError } from './types.js'

export type WorkflowDraftNodeRunRecord = {
  nodeId: string
  nodeType: string
  status: NodeRunStatus
  startedAt: number
  finishedAt: number
  elapsedMs: number
  iterationIndex?: number
  outputs?: Record<string, unknown>
  error?: RunError
}

export const toWorkflowDraftNodeRunRecord = (
  nodeType: string,
  result: NodeExecutionResult,
  iterationIndex?: number,
): WorkflowDraftNodeRunRecord => ({
  nodeId: result.nodeId,
  nodeType,
  status: result.status,
  startedAt: result.startedAt,
  finishedAt: result.finishedAt,
  elapsedMs: result.elapsedMs,
  ...(iterationIndex !== undefined ? { iterationIndex } : {}),
  ...(result.outputs ? { outputs: result.outputs } : {}),
  ...(result.error ? { error: result.error } : {}),
})

/** Align single-node debug results with draft-run nodeRuns for API + web `_lastRun`. */
export const workflowDraftNodeRunRecordFromDebug = (
  nodeType: string,
  result: NodeDebugResult,
  iterationIndex?: number,
): WorkflowDraftNodeRunRecord => ({
  nodeId: result.nodeId,
  nodeType,
  status: result.status,
  startedAt: result.startedAt,
  finishedAt: result.finishedAt,
  elapsedMs: result.elapsedMs,
  ...(iterationIndex !== undefined ? { iterationIndex } : {}),
  ...(result.outputs ? { outputs: result.outputs } : {}),
  ...(result.error ? { error: result.error } : {}),
})
