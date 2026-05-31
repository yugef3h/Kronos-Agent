import { fromNodeDebugResult } from '../executorBridge.js'
import { executeLlmNode } from '../../executors/llmNodeExecutor.js'
import { executeLlmNodeDebug } from '../../debug/llmNodeDebugExecutor.js'
import { RunContext } from '../../runner/runContext.js'
import {
  toWorkflowDraftNodeRunRecord,
  workflowDraftNodeRunRecordFromDebug,
} from '../nodeRunRecord.js'
import { NodeRunStatus } from '../../types/types.js'

jest.mock('../../debug/llmNodeDebugExecutor.js', () => ({
  executeLlmNodeDebug: jest.fn(async (request: { node: { id: string } }) => ({
    nodeId: request.node.id,
    status: NodeRunStatus.Succeeded,
    startedAt: 10,
    finishedAt: 20,
    elapsedMs: 10,
    outputs: { text: 'mock llm answer' },
  })),
}))

describe('executorBridge merge', () => {
  it('maps graph execution result to the same nodeRun record shape as debug', async () => {
    const context = new RunContext({
      runId: 'run_merge',
      appId: 'wf_test',
      inputs: { query: 'hello' },
    })

    const debugResult = await executeLlmNodeDebug({
      appId: 'wf_test',
      node: {
        id: 'llm-1',
        type: 'llm',
        inputs: {
          model: {
            provider: 'virtual',
            name: 'zhiling',
            mode: 'chat',
            completionParams: { temperature: 0.7, topP: 1, topK: 1, maxTokens: 256 },
          },
          promptTemplate: [{ id: 'p1', role: 'user', text: '{{#sys.query#}}' }],
        },
      },
      context: { variables: { 'sys.query': 'hello' } },
    })

    const graphResult = await executeLlmNode({
      runId: 'run_merge',
      appId: 'wf_test',
      node: {
        id: 'llm-1',
        type: 'llm',
        inputs: debugResult.outputs,
      },
      context,
    })

    const fromDebug = workflowDraftNodeRunRecordFromDebug('llm', debugResult)
    const fromGraph = toWorkflowDraftNodeRunRecord('llm', fromNodeDebugResult(debugResult))

    expect(fromGraph).toEqual(fromDebug)
    expect(graphResult.outputs).toEqual(debugResult.outputs)
    expect(fromGraph.outputs?.text).toBe('mock llm answer')
  })
})
