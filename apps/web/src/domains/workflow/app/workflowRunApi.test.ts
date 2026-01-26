import {
  WORKFLOW_DRAFT_RUN_NOT_IMPLEMENTED_CODE,
  WorkflowRunApiError,
  buildWorkflowDraftRunBasePath,
  buildWorkflowDraftRunPath,
  getWorkflowDraftRunEventsUrl,
  isWorkflowDraftRunNotImplementedError,
  parseWorkflowRunApiError,
} from './workflowRunApi'

describe('workflowRunApi', () => {
  it('builds draft run api paths', () => {
    expect(buildWorkflowDraftRunBasePath('wf_test')).toBe('/api/workflow/apps/wf_test/draft-runs')
    expect(buildWorkflowDraftRunPath('wf_test', 'run_abc')).toBe(
      '/api/workflow/apps/wf_test/draft-runs/run_abc',
    )
    expect(getWorkflowDraftRunEventsUrl('wf_test', 'run_abc')).toContain(
      '/api/workflow/apps/wf_test/draft-runs/run_abc/events',
    )
  })

  it('parses json api errors', async () => {
    const response = new Response(
      JSON.stringify({
        error: 'Workflow draft run is not implemented yet',
        code: WORKFLOW_DRAFT_RUN_NOT_IMPLEMENTED_CODE,
      }),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const error = await parseWorkflowRunApiError(response, 'fallback')
    expect(error).toBeInstanceOf(WorkflowRunApiError)
    expect(error.status).toBe(501)
    expect(error.code).toBe(WORKFLOW_DRAFT_RUN_NOT_IMPLEMENTED_CODE)
    expect(isWorkflowDraftRunNotImplementedError(error)).toBe(true)
  })
})
