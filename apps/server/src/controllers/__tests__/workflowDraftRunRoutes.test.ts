import { normalizeWorkflowRunId } from './workflowRunId.js'

describe('workflowDraftRunRoutes helpers', () => {
  it('normalizes run ids', () => {
    expect(normalizeWorkflowRunId('run_abc123')).toBe('run_abc123')
    expect(normalizeWorkflowRunId('../run_evil')).toBeNull()
    expect(normalizeWorkflowRunId('bad-id')).toBeNull()
  })
})
