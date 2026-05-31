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
    outputs: { text: 'ok' },
  })),
}))

import type { Response } from 'express'
import { WorkflowRunStatus } from '../../../services/workflow/types.js'
import { workflowRunStore } from '../../../services/workflow/workflowRunStore.js'
import { listWorkflowRunEvents } from '../../../services/workflow/workflowRunEvents.js'
import {
  handleCancelWorkflowDraftRunPost,
  handleStartWorkflowDraftRunPost,
  handleWorkflowDraftRunEventsGet,
} from '../../../workflowDraftRunRoutes.js'

const createMockResponse = () => {
  let statusCode = 200
  let body: unknown
  const headers = new Map<string, string>()
  const chunks: string[] = []

  const response = {
    status(code: number) {
      statusCode = code
      return this
    },
    json(payload: unknown) {
      body = payload
      return this
    },
    setHeader(name: string, value: string) {
      headers.set(name, value)
    },
    write(chunk: string) {
      chunks.push(chunk)
    },
    end() {
      return this
    },
  } as unknown as Response

  return {
    response,
    getStatusCode: () => statusCode,
    getBody: () => body,
    getHeaders: () => headers,
    getChunks: () => chunks.join(''),
  }
}

describe('workflowDraftRunRoutes events and cancel', () => {
  beforeEach(async () => {
    await workflowRunStore.clear()
  })

  it('streams workflow run events after execution', async () => {
    const start = createMockResponse()

    await handleStartWorkflowDraftRunPost({
      params: { appId: 'wf_test' },
      body: {
        dsl: {
          workflow: {
            graph: {
              nodes: [
                { id: 'start-1', data: { type: 'start', variables: [] } },
                { id: 'end-1', data: { type: 'end' } },
              ],
              edges: [{ source: 'start-1', target: 'end-1', sourceHandle: 'out' }],
            },
          },
        },
        inputs: { query: 'hello' },
      },
    }, start.response)

    const startBody = start.getBody() as { run: { runId: string } }
    const events = await listWorkflowRunEvents(startBody.run.runId)
    expect(events.some((event) => event.type === 'workflow_finished')).toBe(true)

    const sse = createMockResponse()
    await handleWorkflowDraftRunEventsGet({
      params: { appId: 'wf_test', runId: startBody.run.runId },
    }, sse.response)

    expect(sse.getHeaders().get('Content-Type')).toBe('text/event-stream')
    expect(sse.getChunks()).toContain('workflow_finished')
  })

  it('cancels a running workflow draft run record', async () => {
    const created = await workflowRunStore.create({
      appId: 'wf_test',
      status: WorkflowRunStatus.Running,
    })

    const { response, getBody } = createMockResponse()
    await handleCancelWorkflowDraftRunPost({
      params: { appId: 'wf_test', runId: created.runId },
    }, response)

    const body = getBody() as { run: { status: WorkflowRunStatus } }
    expect(body.run.status).toBe(WorkflowRunStatus.Cancelled)
  })
})
