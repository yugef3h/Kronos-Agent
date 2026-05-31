import {
  NodeRunStatus,
  WorkflowRunStatus,
  isTerminalNodeRunStatus,
  isTerminalWorkflowRunStatus,
} from '../types.js'

describe('workflow run types', () => {
  it('aligns waiting/stopped with web WorkflowRunningStatus', () => {
    expect(WorkflowRunStatus.Waiting).toBe('waiting')
    expect(WorkflowRunStatus.Stopped).toBe('stopped')
  })

  it('aligns node statuses with web NodeRunningStatus', () => {
    expect(NodeRunStatus.Running).toBe('running')
    expect(NodeRunStatus.NotStart).toBe('not-start')
  })

  it('detects terminal workflow statuses', () => {
    expect(isTerminalWorkflowRunStatus(WorkflowRunStatus.Succeeded)).toBe(true)
    expect(isTerminalWorkflowRunStatus(WorkflowRunStatus.Running)).toBe(false)
    expect(isTerminalWorkflowRunStatus(WorkflowRunStatus.Queued)).toBe(false)
  })

  it('detects terminal node statuses', () => {
    expect(isTerminalNodeRunStatus(NodeRunStatus.Succeeded)).toBe(true)
    expect(isTerminalNodeRunStatus(NodeRunStatus.Retry)).toBe(false)
  })
})
