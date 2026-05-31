jest.mock('../../../../rag/knowledgeFacade.js', () => ({
  runKnowledgeRetrievalQuery: jest.fn(),
}))

import { NodeRunStatus } from '../types.js'
import { registerBuiltInNodeExecutors } from '../registerNodeExecutors.js'
import { workflowRunStore } from '../workflowRunStore.js'
import { runWorkflowDraftGraph } from '../workflowDraftRunner.js'
import { buildExecutionGraph } from '../buildExecutionGraph.js'
import type { WorkflowDraftDslGraph } from '../workflowDsl.js'

jest.mock('./debug/llmNodeDebugExecutor.js', () => ({
  executeLlmNodeDebug: jest.fn(async (request: { node: { id: string } }) => ({
    nodeId: request.node.id,
    status: NodeRunStatus.Succeeded,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    elapsedMs: 1,
    outputs: { text: 'mock llm answer' },
  })),
}))

const createStartLlmEndGraph = (): WorkflowDraftDslGraph => {
  const nodes = [
    {
      id: 'start-1',
      data: { type: 'start', variables: [] },
    },
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
        promptTemplate: [{ id: 'p1', role: 'user', text: '请回答：{{#sys.query#}}' }],
        context: { enabled: false, variableSelector: [] },
        structuredOutputEnabled: false,
      },
    },
    {
      id: 'end-1',
      data: { type: 'end' },
    },
  ]

  return {
    nodes,
    edges: [
      { source: 'start-1', target: 'llm-1', sourceHandle: 'out' },
      { source: 'llm-1', target: 'end-1', sourceHandle: 'out' },
    ],
    nodeById: new Map(nodes.map((node) => [node.id, node])),
  }
}

describe('workflowDraftRunner llm chain', () => {
  beforeEach(async () => {
    await workflowRunStore.clear()
    registerBuiltInNodeExecutors()
  })

  it('runs start then llm nodes', async () => {
    const dslGraph = createStartLlmEndGraph()
    const built = buildExecutionGraph(dslGraph)
    expect(built.ok).toBe(true)
    if (!built.ok) {
      return
    }

    const result = await runWorkflowDraftGraph({
      appId: 'wf_test',
      graph: dslGraph,
      executionGraph: built.graph,
      inputs: { query: '什么是 RAG' },
    })

    expect(result.nodeRuns.map((run) => run.nodeType)).toEqual(['start', 'llm', 'end'])
    expect(result.nodeRuns[1]?.status).toBe(NodeRunStatus.Succeeded)
    expect(result.nodeRuns[1]?.outputs?.text).toBe('mock llm answer')
  })
})
