import { WorkflowRunStatus, isTerminalWorkflowRunStatus } from './types.js'

export class WorkflowFsmTransitionError extends Error {
  readonly from: WorkflowRunStatus
  readonly to: WorkflowRunStatus

  constructor(from: WorkflowRunStatus, to: WorkflowRunStatus) {
    super(`Invalid workflow run transition: ${from} -> ${to}`)
    this.name = 'WorkflowFsmTransitionError'
    this.from = from
    this.to = to
  }
}

const WORKFLOW_FSM_TRANSITIONS: Readonly<Record<WorkflowRunStatus, readonly WorkflowRunStatus[]>> = {
  [WorkflowRunStatus.Queued]: [
    WorkflowRunStatus.Waiting,
    WorkflowRunStatus.Running,
    WorkflowRunStatus.Cancelled,
  ],
  [WorkflowRunStatus.Waiting]: [
    WorkflowRunStatus.Running,
    WorkflowRunStatus.Cancelled,
  ],
  [WorkflowRunStatus.Running]: [
    WorkflowRunStatus.Succeeded,
    WorkflowRunStatus.Failed,
    WorkflowRunStatus.Stopped,
    WorkflowRunStatus.Cancelled,
    WorkflowRunStatus.Paused,
    WorkflowRunStatus.Retry,
  ],
  [WorkflowRunStatus.Retry]: [
    WorkflowRunStatus.Running,
    WorkflowRunStatus.Failed,
    WorkflowRunStatus.Cancelled,
  ],
  [WorkflowRunStatus.Paused]: [
    WorkflowRunStatus.Running,
    WorkflowRunStatus.Stopped,
    WorkflowRunStatus.Cancelled,
  ],
  [WorkflowRunStatus.Succeeded]: [],
  [WorkflowRunStatus.Failed]: [],
  [WorkflowRunStatus.Stopped]: [],
  [WorkflowRunStatus.Cancelled]: [],
}

export const getAllowedWorkflowRunTransitions = (
  status: WorkflowRunStatus,
): readonly WorkflowRunStatus[] => WORKFLOW_FSM_TRANSITIONS[status] ?? []

export const canTransitionWorkflowRun = (
  from: WorkflowRunStatus,
  to: WorkflowRunStatus,
): boolean => {
  if (from === to) {
    return true
  }

  return getAllowedWorkflowRunTransitions(from).includes(to)
}

export const assertWorkflowRunTransition = (
  from: WorkflowRunStatus,
  to: WorkflowRunStatus,
): void => {
  if (!canTransitionWorkflowRun(from, to)) {
    throw new WorkflowFsmTransitionError(from, to)
  }
}

export const transitionWorkflowRun = (
  from: WorkflowRunStatus,
  to: WorkflowRunStatus,
): WorkflowRunStatus => {
  assertWorkflowRunTransition(from, to)
  return to
}

export const isWorkflowRunActive = (status: WorkflowRunStatus): boolean =>
  !isTerminalWorkflowRunStatus(status)
    && status !== WorkflowRunStatus.Paused
