import {
  NodeRunningStatus,
} from '../types/common'

const EDGE_COLOR_TOKENS = {
  normal: 'var(--color-workflow-link-line-normal, #94a3b8)',
  running: 'var(--color-workflow-link-line-handle, #3b82f6)',
  success: 'var(--color-workflow-link-line-success-handle, #22c55e)',
  error: 'var(--color-workflow-link-line-error-handle, #ef4444)',
  failure: 'var(--color-workflow-link-line-failure-handle, #f59e0b)',
} as const

export const getEdgeColor = (nodeRunningStatus?: NodeRunningStatus, isFailBranch?: boolean) => {
  if (nodeRunningStatus === NodeRunningStatus.Succeeded)
    return EDGE_COLOR_TOKENS.success

  if (nodeRunningStatus === NodeRunningStatus.Failed)
    return EDGE_COLOR_TOKENS.error

  if (nodeRunningStatus === NodeRunningStatus.Exception)
    return EDGE_COLOR_TOKENS.failure

  if (nodeRunningStatus === NodeRunningStatus.Running) {
    if (isFailBranch)
      return EDGE_COLOR_TOKENS.failure

    return EDGE_COLOR_TOKENS.running
  }

  return EDGE_COLOR_TOKENS.normal
}
