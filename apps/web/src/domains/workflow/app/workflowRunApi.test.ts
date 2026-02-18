import {
  WorkflowRunApiError,
  buildWorkflowDraftRunBasePath,
  buildWorkflowDraftRunPath,
  getWorkflowDraftRunEventsUrl,
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
        error: 'Invalid draft run request body',
        code: 'draft_run_request_invalid',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const error = await parseWorkflowRunApiError(response, 'fallback')
    expect(error).toBeInstanceOf(WorkflowRunApiError)
    expect(error.status).toBe(400)
    expect(error.code).toBe('draft_run_request_invalid')
    expect(error.message).toBe('Invalid draft run request body')
  })

  it('falls back when response body is not json', async () => {
    const response = new Response('not json', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })

    const error = await parseWorkflowRunApiError(response, 'Server error')
    expect(error.message).toBe('Server error')
    expect(error.status).toBe(500)
    expect(error.code).toBeUndefined()
  })
})
