import { WorkflowRunStatus } from '../types/types.js'
import { workflowRunStore } from '../store/workflowRunStore.js'
import { isTerminalWorkflowRunStatus } from '../types/types.js'
import { getWorkflowRunCancellationStore } from './createWorkflowRunCancellationStore.js'

const store = () => getWorkflowRunCancellationStore()

export const requestWorkflowRunCancellation = async (runId: string): Promise<void> => {
  await store().markCancelled(runId)
}

export const isWorkflowRunCancelled = async (runId: string): Promise<boolean> =>
  store().isCancelled(runId)

export const clearWorkflowRunCancellation = async (runId: string): Promise<void> => {
  await store().clear(runId)
}

export const cancelWorkflowRunRecord = async (runId: string) => {
  await requestWorkflowRunCancellation(runId)

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
