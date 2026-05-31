import { transitionWorkflowRun } from './workflowFsm.js'
import type { UpdateWorkflowRunPatch, WorkflowRunRecord } from './types.js'
import { DEFAULT_WORKFLOW_RUN_TTL_MS } from './memoryWorkflowRunStore.js'

export const buildUpdatedWorkflowRunRecord = (
  current: WorkflowRunRecord,
  patch: UpdateWorkflowRunPatch,
  now = Date.now(),
): WorkflowRunRecord => {
  const nextStatus = patch.status ?? current.status
  if (nextStatus !== current.status) {
    transitionWorkflowRun(current.status, nextStatus)
  }

  const next: WorkflowRunRecord = {
    ...current,
    status: nextStatus,
    startedAt: patch.startedAt ?? current.startedAt,
    finishedAt: patch.finishedAt ?? current.finishedAt,
    updatedAt: now,
    expiresAt: patch.touchTtl === false
      ? current.expiresAt
      : now + (patch.ttlMs ?? DEFAULT_WORKFLOW_RUN_TTL_MS),
  }

  if (patch.error === null) {
    delete next.error
  } else if (patch.error !== undefined) {
    next.error = patch.error
  }

  return next
}
