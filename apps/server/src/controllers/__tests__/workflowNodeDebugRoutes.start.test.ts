import { NodeRunStatus } from '../../services/workflow/types/types.js'
import { workflowRunStore } from '../../services/workflow/store/workflowRunStore.js'
import { NODE_DEBUG_EXECUTOR_NOT_FOUND_CODE } from '../workflowNodeDebugRoutes.js'
import { postWorkflowNodeDebugStart } from '../workflowNodeDebugRoutes.testUtils.js'

describe('POST /workflow/debug/node (start)', () => {
  it('returns normalized start node debug result', async () => {
    const { status, body } = await postWorkflowNodeDebugStart({
      appId: 'wf_test',
      node: {
        id: 'trigger-1',
        type: 'start',
        inputs: {
          variables: [
            {
              id: 'var-1',
              variable: 'topic',
              label: '主题',
              type: 'text-input',
              required: true,
              options: [],
            },
          ],
        },
      },
      inputs: {
        topic: 'RAG',
        query: '什么是 RAG',
      },
    })

    expect(status).toBe(200)
    expect(body).toMatchObject({
      result: {
        nodeId: 'trigger-1',
        status: NodeRunStatus.Succeeded,
        outputs: {
          topic: 'RAG',
          'sys.query': '什么是 RAG',
        },
      },
      run: {
        appId: 'wf_test',
        kind: 'node_debug',
        status: 'succeeded',
        nodeDebug: {
          nodeId: 'trigger-1',
          nodeType: 'start',
          status: NodeRunStatus.Succeeded,
        },
      },
    })

    const runId = (body as { run: { runId: string } }).run.runId
    expect((await workflowRunStore.get(runId))?.nodeDebug?.outputs?.topic).toBe('RAG')
  })

  it('returns 400 when required start inputs are missing', async () => {
    const { status, body } = await postWorkflowNodeDebugStart({
      appId: 'wf_test',
      node: {
        id: 'trigger-1',
        type: 'start',
        inputs: {
          variables: [
            {
              id: 'var-1',
              variable: 'topic',
              label: '主题',
              type: 'text-input',
              required: true,
              options: [],
            },
          ],
        },
      },
      inputs: {},
    })

    expect(status).toBe(200)
    expect(body).toMatchObject({
      result: {
        status: NodeRunStatus.Failed,
        error: { code: 'start_inputs_invalid' },
      },
    })
  })

  it('returns 404 when executor is not registered', async () => {
    const { status, body } = await postWorkflowNodeDebugStart({
      appId: 'wf_test',
      node: { id: 'loop-1', type: 'loop' },
    })

    expect(status).toBe(404)
    expect(body).toMatchObject({
      code: NODE_DEBUG_EXECUTOR_NOT_FOUND_CODE,
      kind: 'loop',
    })
  })
})
