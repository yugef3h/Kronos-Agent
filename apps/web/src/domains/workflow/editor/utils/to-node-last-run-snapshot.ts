import type { DebugWorkflowNodeResponse } from '../../app/workflowNodeDebugApi'
import type { WorkflowDraftNodeRunRecord } from '../../app/workflowRunApi'
import type { NodeRunningStatus } from '../types/common'
import type { NodeLastRunSnapshot } from '../types/run'

const buildNodeLastRunSnapshot = (
  runId: string,
  record: {
    nodeId: string
    status: NodeRunningStatus
    startedAt?: number
    finishedAt?: number
    elapsedMs?: number
    iterationIndex?: number
    inputs?: Record<string, unknown>
    outputs?: Record<string, unknown>
    error?: NodeLastRunSnapshot['error']
  },
): NodeLastRunSnapshot => ({
  runId,
  nodeId: record.nodeId,
  status: record.status,
  ...(record.startedAt !== undefined ? { startedAt: record.startedAt } : {}),
  ...(record.finishedAt !== undefined ? { finishedAt: record.finishedAt } : {}),
  ...(record.elapsedMs !== undefined ? { elapsedMs: record.elapsedMs } : {}),
  ...(record.iterationIndex !== undefined ? { iterationIndex: record.iterationIndex } : {}),
  ...(record.inputs ? { inputs: record.inputs } : {}),
  ...(record.outputs ? { outputs: record.outputs } : {}),
  ...(record.error ? { error: record.error } : {}),
})

/** Single-node debug API → canvas `_lastRun`. */
export const toNodeLastRunSnapshot = (
  response: DebugWorkflowNodeResponse,
): NodeLastRunSnapshot => {
  const { result, run } = response

  return buildNodeLastRunSnapshot(run?.runId ?? '', {
    nodeId: result.nodeId,
    status: result.status,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    elapsedMs: result.elapsedMs,
    ...(result.inputs ? { inputs: result.inputs } : {}),
    ...(result.outputs ? { outputs: result.outputs } : {}),
    ...(result.error ? { error: result.error } : {}),
  })
}

/** Draft-run `nodeRuns[]` entry → canvas `_lastRun` (same shape as debug). */
export const toNodeLastRunSnapshotFromDraftRun = (
  runId: string,
  record: WorkflowDraftNodeRunRecord,
): NodeLastRunSnapshot => buildNodeLastRunSnapshot(runId, {
  nodeId: record.nodeId,
  status: record.status as NodeRunningStatus,
  startedAt: record.startedAt,
  finishedAt: record.finishedAt,
  elapsedMs: record.elapsedMs,
  ...(record.iterationIndex !== undefined ? { iterationIndex: record.iterationIndex } : {}),
  ...(record.outputs ? { outputs: record.outputs } : {}),
  ...(record.error ? { error: record.error } : {}),
})
