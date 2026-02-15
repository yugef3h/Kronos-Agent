import type { WorkflowDraftNodeRunRecord } from '../../app/workflowRunApi'
import type { NodeLastRunSnapshot } from '../types/run'
import type { NodeRunningStatus } from '../types/common'

export const toNodeLastRunFromDraftRun = (
  runId: string,
  record: WorkflowDraftNodeRunRecord,
): NodeLastRunSnapshot => ({
  runId,
  nodeId: record.nodeId,
  status: record.status as NodeRunningStatus,
  startedAt: record.startedAt,
  finishedAt: record.finishedAt,
  elapsedMs: record.elapsedMs,
  ...(record.iterationIndex !== undefined ? { iterationIndex: record.iterationIndex } : {}),
  ...(record.outputs ? { outputs: record.outputs } : {}),
  ...(record.error ? { error: record.error } : {}),
})
