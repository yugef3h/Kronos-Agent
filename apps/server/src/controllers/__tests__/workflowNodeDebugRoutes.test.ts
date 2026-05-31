import { parseNodeDebugRequestBody } from './workflowNodeDebugRequest.js'
import { NODE_DEBUG_EXECUTOR_NOT_FOUND_CODE } from './workflowNodeDebugRoutes.js'

describe('workflowNodeDebugRoutes helpers', () => {
  it('parses a valid start node debug request', () => {
    const parsed = parseNodeDebugRequestBody({
      appId: 'wf_demo',
      node: {
        id: 'start-1',
        type: 'start',
        inputs: { variables: [] },
      },
      inputs: { query: 'hi' },
    })

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    expect(parsed.request).toEqual({
      appId: 'wf_demo',
      node: {
        id: 'start-1',
        type: 'start',
        inputs: { variables: [] },
      },
      inputs: { query: 'hi' },
    })
  })

  it('rejects invalid app id', () => {
    const parsed = parseNodeDebugRequestBody({
      appId: '../evil',
      node: { id: 'start-1', type: 'start' },
    })

    expect(parsed).toEqual({
      ok: false,
      status: 400,
      payload: {
        error: 'Invalid app id',
        code: 'node_debug_app_id_invalid',
      },
    })
  })

  it('rejects missing node payload', () => {
    const parsed = parseNodeDebugRequestBody({ inputs: {} })

    expect(parsed).toMatchObject({
      ok: false,
      status: 400,
      payload: { code: 'node_debug_request_invalid' },
    })
  })
})

describe('workflowNodeDebugRoutes error codes', () => {
  it('exports executor-not-found code for route tests', () => {
    expect(NODE_DEBUG_EXECUTOR_NOT_FOUND_CODE).toBe('node_debug_executor_not_found')
  })
})
