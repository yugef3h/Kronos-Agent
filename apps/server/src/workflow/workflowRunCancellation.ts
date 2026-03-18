import { WorkflowRunStatus } from './types.js'
import { workflowRunStore } from './workflowRunStore.js'
import { isTerminalWorkflowRunStatus } from './types.js'

const cancelledRunIds = new Set<string>()

export const requestWorkflowRunCancellation = (runId: string): void => {
  cancelledRunIds.add(runId)
}

export const isWorkflowRunCancelled = (runId: string): boolean =>
  cancelledRunIds.has(runId)

export const clearWorkflowRunCancellation = (runId: string): void => {
  cancelledRunIds.delete(runId)
}

export const cancelWorkflowRunRecord = async (runId: string) => {
  requestWorkflowRunCancellation(runId)

  const current = await workflowRunStore.get(runId)
  if (!current || isTerminalWorkflowRunStatus(current.status)) {
    return current
  }

  return workflowRunStore.update(runId, {
    status: WorkflowRunStatus.Cancelled,
    finishedAt: Date.now(),
    error: {
      code: 'workflow_run_cancelled',
      message: 'Workflow run cancelled',
    },
  })
}
