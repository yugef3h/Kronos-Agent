import { NodeRunningStatus, WorkflowRunningStatus } from './common'
import type { NodeLastRunSnapshot } from './run'
import {
  WorkflowRunStatus,
  isTerminalNodeRunStatus,
  isTerminalWorkflowRunStatus,
  toWorkflowRunStatus,
} from './run'

describe('workflow run types', () => {
  it('aligns WorkflowRunStatus waiting/running with WorkflowRunningStatus', () => {
    expect(WorkflowRunStatus.Waiting).toBe(WorkflowRunningStatus.Waiting)
    expect(WorkflowRunStatus.Running).toBe(WorkflowRunningStatus.Running)
    expect(WorkflowRunStatus.Succeeded).toBe(WorkflowRunningStatus.Succeeded)
  })

  it('maps WorkflowRunningStatus to WorkflowRunStatus', () => {
    expect(toWorkflowRunStatus(WorkflowRunningStatus.Failed)).toBe(WorkflowRunStatus.Failed)
  })

  it('accepts NodeLastRunSnapshot shape', () => {
    const snapshot: NodeLastRunSnapshot = {
      runId: 'run_1',
      nodeId: 'trigger-1',
      status: NodeRunningStatus.Succeeded,
      inputs: { query: 'hi' },
      outputs: { text: 'ok' },
      elapsedMs: 12,
    }
    expect(snapshot.status).toBe('succeeded')
  })

  it('detects terminal statuses', () => {
    expect(isTerminalWorkflowRunStatus(WorkflowRunStatus.Cancelled)).toBe(true)
    expect(isTerminalWorkflowRunStatus(WorkflowRunStatus.Queued)).toBe(false)
    expect(isTerminalNodeRunStatus(NodeRunningStatus.Retry)).toBe(false)
  })
})
