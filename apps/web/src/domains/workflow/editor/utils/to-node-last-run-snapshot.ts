import type { DebugWorkflowNodeResponse } from '../../app/workflowNodeDebugApi'
import type { NodeLastRunSnapshot } from '../types/run'

export const toNodeLastRunSnapshot = (
  response: DebugWorkflowNodeResponse,
): NodeLastRunSnapshot => {
  const { result, run } = response

  return {
    runId: run?.runId ?? '',
    nodeId: result.nodeId,
    status: result.status,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    elapsedMs: result.elapsedMs,
    ...(result.inputs ? { inputs: result.inputs } : {}),
    ...(result.outputs ? { outputs: result.outputs } : {}),
    ...(result.error ? { error: result.error } : {}),
  }
}
