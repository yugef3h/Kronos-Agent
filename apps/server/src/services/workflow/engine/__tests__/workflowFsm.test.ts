import { WorkflowRunStatus } from '../../types/types.js'
import {
  WorkflowFsmTransitionError,
  canTransitionWorkflowRun,
  getAllowedWorkflowRunTransitions,
  isWorkflowRunActive,
  transitionWorkflowRun,
} from '../../engine/workflowFsm.js'

describe('workflowFsm', () => {
  it('allows queued to running', () => {
    expect(canTransitionWorkflowRun(WorkflowRunStatus.Queued, WorkflowRunStatus.Running)).toBe(true)
    expect(transitionWorkflowRun(WorkflowRunStatus.Queued, WorkflowRunStatus.Running)).toBe(
      WorkflowRunStatus.Running,
    )
  })

  it('allows running to terminal states', () => {
    expect(canTransitionWorkflowRun(WorkflowRunStatus.Running, WorkflowRunStatus.Succeeded)).toBe(true)
    expect(canTransitionWorkflowRun(WorkflowRunStatus.Running, WorkflowRunStatus.Failed)).toBe(true)
    expect(canTransitionWorkflowRun(WorkflowRunStatus.Running, WorkflowRunStatus.Cancelled)).toBe(true)
  })

  it('rejects transitions from terminal states', () => {
    expect(canTransitionWorkflowRun(WorkflowRunStatus.Succeeded, WorkflowRunStatus.Running)).toBe(false)
    expect(() => transitionWorkflowRun(WorkflowRunStatus.Succeeded, WorkflowRunStatus.Running))
      .toThrow(WorkflowFsmTransitionError)
  })

  it('exposes allowed transitions per state', () => {
    expect(getAllowedWorkflowRunTransitions(WorkflowRunStatus.Retry)).toEqual([
      WorkflowRunStatus.Running,
      WorkflowRunStatus.Failed,
      WorkflowRunStatus.Cancelled,
    ])
  })

  it('detects active workflow runs', () => {
    expect(isWorkflowRunActive(WorkflowRunStatus.Running)).toBe(true)
    expect(isWorkflowRunActive(WorkflowRunStatus.Paused)).toBe(false)
    expect(isWorkflowRunActive(WorkflowRunStatus.Succeeded)).toBe(false)
  })
})
