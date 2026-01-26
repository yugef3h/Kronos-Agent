import type { Response } from 'express'
import {
  DRAFT_RUN_NOT_IMPLEMENTED,
  normalizeWorkflowRunId,
  respondDraftRunNotImplemented,
} from './workflowDraftRunRoutes.js'

const createMockResponse = () => {
  let statusCode = 200
  let body: unknown

  const response = {
    status(code: number) {
      statusCode = code
      return this
    },
    json(payload: unknown) {
      body = payload
      return this
    },
  } as unknown as Response

  return {
    response,
    getStatusCode: () => statusCode,
    getBody: () => body,
  }
}

describe('workflowDraftRunRoutes helpers', () => {
  it('normalizes run ids', () => {
    expect(normalizeWorkflowRunId('run_abc123')).toBe('run_abc123')
    expect(normalizeWorkflowRunId('../run_evil')).toBeNull()
  })

  it('responds with 501 not implemented payload', () => {
    const { response, getStatusCode, getBody } = createMockResponse()

    respondDraftRunNotImplemented(response)

    expect(getStatusCode()).toBe(501)
    expect(getBody()).toEqual(DRAFT_RUN_NOT_IMPLEMENTED)
  })
})

describe('workflowDraftRunRoutes param validation', () => {
  it('rejects invalid run id before 501', () => {
    const { response, getStatusCode, getBody } = createMockResponse()
    const runId = normalizeWorkflowRunId('bad-id')

    if (!runId) {
      response.status(400).json({ error: 'Invalid run id' })
    } else {
      respondDraftRunNotImplemented(response)
    }

    expect(getStatusCode()).toBe(400)
    expect(getBody()).toEqual({ error: 'Invalid run id' })
  })
})
