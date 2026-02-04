jest.mock('../rag/knowledgeFacade.js', () => ({
  runKnowledgeRetrievalQuery: jest.fn(),
}))

jest.mock('../workflow/debug/llmNodeDebugExecutor.js', () => ({
  executeLlmNodeDebug: jest.fn(async (request: { node: { id: string } }) => ({
    nodeId: request.node.id,
    status: 'succeeded',
    startedAt: Date.now(),
    finishedAt: Date.now(),
    elapsedMs: 1,
    outputs: { text: 'mock llm answer' },
  })),
}))

import type { Response } from 'express'
import { WorkflowRunStatus } from '../workflow/types.js'
import { workflowRunStore } from '../workflow/workflowRunStore.js'
import { handleStartWorkflowDraftRunPost } from './workflowDraftRunRoutes.js'

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

describe('POST /workflow/apps/:appId/draft-runs', () => {
  beforeEach(() => {
    workflowRunStore.clear()
  })

  it('runs start to llm to end chain', async () => {
    const { response, getStatusCode, getBody } = createMockResponse()

    await handleStartWorkflowDraftRunPost({
      params: { appId: 'wf_test' },
      body: {
        dsl: {
          workflow: {
            graph: {
              nodes: [
                { id: 'start-1', data: { type: 'start', variables: [] } },
                {
                  id: 'llm-1',
                  data: {
                    type: 'llm',
                    model: {
                      provider: 'virtual',
                      name: 'zhiling',
                      mode: 'chat',
                      completionParams: { temperature: 0.7, topP: 1, topK: 1, maxTokens: 256 },
                    },
                    promptTemplate: [{ id: 'p1', role: 'user', text: '{{#sys.query#}}' }],
                    context: { enabled: false, variableSelector: [] },
                    structuredOutputEnabled: false,
                  },
                },
                { id: 'end-1', data: { type: 'end' } },
              ],
              edges: [
                { source: 'start-1', target: 'llm-1', sourceHandle: 'out' },
                { source: 'llm-1', target: 'end-1', sourceHandle: 'out' },
              ],
            },
          },
        },
        inputs: { query: 'hello' },
      },
    }, response)

    expect(getStatusCode()).toBe(201)
    const body = getBody() as {
      run: { status: WorkflowRunStatus }
      nodeRuns: Array<{ nodeType: string }>
    }
    expect(body.run.status).toBe(WorkflowRunStatus.Succeeded)
    expect(body.nodeRuns.map((run) => run.nodeType)).toEqual(['start', 'llm', 'end'])
  })
})
