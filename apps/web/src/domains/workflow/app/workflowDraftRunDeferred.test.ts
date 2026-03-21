import { NodeRunStatus, WorkflowRunStatus } from '../editor/types/run'
import { isDeferredWorkflowDraftRun } from './workflowDraftRunDeferred'

describe('isDeferredWorkflowDraftRun', () => {
  const baseRun = {
    runId: 'run_1',
    appId: 'wf_test',
    startedAt: 1,
  }

  it('returns true for queued runs with empty nodeRuns', () => {
    expect(isDeferredWorkflowDraftRun(
      { ...baseRun, status: WorkflowRunStatus.Queued },
      [],
    )).toBe(true)
  })

  it('returns false for finished sync runs with nodeRuns', () => {
    expect(isDeferredWorkflowDraftRun(
      { ...baseRun, status: WorkflowRunStatus.Succeeded, finishedAt: 2 },
      [{
        nodeId: 'llm-1',
        nodeType: 'llm',
        status: NodeRunStatus.Succeeded,
        startedAt: 1,
        finishedAt: 2,
        elapsedMs: 1,
      }],
    )).toBe(false)
  })

  it('returns false for terminal runs without nodeRuns', () => {
    expect(isDeferredWorkflowDraftRun(
      { ...baseRun, status: WorkflowRunStatus.Failed, finishedAt: 2 },
      [],
    )).toBe(false)
  })
})
