import { WorkflowRunStatus } from '../types.js'
import { WorkflowFsmTransitionError } from '../workflowFsm.js'
import { buildUpdatedWorkflowRunRecord } from '../workflowRunRecordPatch.js'

describe('buildUpdatedWorkflowRunRecord', () => {
  const base = {
    runId: 'run_1',
    appId: 'wf_test',
    kind: 'draft' as const,
    status: WorkflowRunStatus.Queued,
    createdAt: 1,
    updatedAt: 1,
    expiresAt: 9_999_999,
  }

  it('allows queued to running', () => {
    const next = buildUpdatedWorkflowRunRecord(base, {
      status: WorkflowRunStatus.Running,
      startedAt: 2,
    })

    expect(next.status).toBe(WorkflowRunStatus.Running)
  })

  it('rejects invalid transition', () => {
    expect(() => buildUpdatedWorkflowRunRecord({
      ...base,
      status: WorkflowRunStatus.Succeeded,
    }, {
      status: WorkflowRunStatus.Running,
    })).toThrow(WorkflowFsmTransitionError)
  })
})
