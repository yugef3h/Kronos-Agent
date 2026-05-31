import type { NodeRunStatus, WorkflowRunRecord, WorkflowRunSummary } from './types.js'
import { NodeRunStatus as NodeRunStatusEnum, WorkflowRunStatus } from './types.js'

export const nodeRunStatusToWorkflowRunStatus = (status: NodeRunStatus): WorkflowRunStatus => {
  switch (status) {
    case NodeRunStatusEnum.Failed:
    case NodeRunStatusEnum.Exception:
      return WorkflowRunStatus.Failed
    case NodeRunStatusEnum.Stopped:
      return WorkflowRunStatus.Stopped
    case NodeRunStatusEnum.Succeeded:
      return WorkflowRunStatus.Succeeded
    default:
      return WorkflowRunStatus.Succeeded
  }
}

export const toWorkflowRunSummary = (record: WorkflowRunRecord): WorkflowRunSummary => {
  const startedAt = record.startedAt ?? record.createdAt
  const finishedAt = record.finishedAt
  const elapsedMs = finishedAt !== undefined ? Math.max(0, finishedAt - startedAt) : undefined

  return {
    runId: record.runId,
    appId: record.appId,
    kind: record.kind,
    status: record.status,
    startedAt,
    ...(finishedAt !== undefined ? { finishedAt } : {}),
    ...(elapsedMs !== undefined ? { elapsedMs } : {}),
    ...(record.error ? { error: record.error } : {}),
    ...(record.nodeDebug ? { nodeDebug: record.nodeDebug } : {}),
  }
}
