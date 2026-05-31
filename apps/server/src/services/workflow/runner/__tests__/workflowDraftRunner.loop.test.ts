jest.mock('../rag/knowledgeFacade.js', () => ({
  runKnowledgeRetrievalQuery: jest.fn(),
}))

jest.mock('./debug/llmNodeDebugExecutor.js', () => ({
  executeLlmNodeDebug: jest.fn(async (request: { node: { id: string } }) => ({
    nodeId: request.node.id,
    status: 'succeeded',
    startedAt: Date.now(),
    finishedAt: Date.now(),
    elapsedMs: 1,
    outputs: { text: `round-${request.node.id}` },
  })),
}))

import { NodeRunStatus } from '../../types.js'
import { registerBuiltInNodeExecutors } from '../../registerNodeExecutors.js'
import { workflowRunStore } from '../../workflowRunStore.js'
import { runWorkflowDraftGraph } from '../../workflowDraftRunner.js'
import { buildExecutionGraph } from '../../buildExecutionGraph.js'
import type { WorkflowDraftDslGraph } from '../../workflowDsl.js'

const createLoopGraph = (): WorkflowDraftDslGraph => {
  const nodes = [
    { id: 'start-1', data: { type: 'start', variables: [] } },
    {
      id: 'loop-1',
      data: {
        type: 'loop',
        start_node_id: 'loop-1__loop_start',
        loop_count: 2,
      },
    },
    {
      id: 'loop-1__loop_start',
      parentId: 'loop-1',
      data: { type: 'loop-start' },
    },
    {
      id: 'llm-inner',
      parentId: 'loop-1',
      data: {
        type: 'llm',
        model: { provider: 'virtual', name: 'zhiling', mode: 'chat' },
        promptTemplate: [{ id: 'p1', role: 'user', text: 'hi' }],
      },
    },
    {
      id: 'loop-1__loop_end',
      parentId: 'loop-1',
      data: { type: 'loop-end' },
    },
    { id: 'end-1', data: { type: 'end' } },
  ]

  return {
    nodes,
    edges: [
      { source: 'start-1', target: 'loop-1', sourceHandle: 'out' },
      { source: 'loop-1', target: 'end-1', sourceHandle: 'out' },
      { source: 'loop-1__loop_start', target: 'llm-inner', sourceHandle: 'out' },
      { source: 'llm-inner', target: 'loop-1__loop_end', sourceHandle: 'out' },
    ],
    nodeById: new Map(nodes.map((node) => [node.id, node])),
  }
}

describe('workflowDraftRunner loop sandbox', () => {
  beforeEach(async () => {
    await workflowRunStore.clear()
    registerBuiltInNodeExecutors()
  })

  it('runs loop container for configured iterations', async () => {
    const dslGraph = createLoopGraph()
    const built = buildExecutionGraph(dslGraph)
    expect(built.ok).toBe(true)
    if (!built.ok) {
      return
    }

    const result = await runWorkflowDraftGraph({
      appId: 'wf_test',
      graph: dslGraph,
      executionGraph: built.graph,
      inputs: { query: 'hello' },
    })

    const loopRun = result.nodeRuns.find((run) => run.nodeType === 'loop')
    expect(loopRun?.status).toBe(NodeRunStatus.Succeeded)
    expect(result.nodeRuns.filter((run) => run.nodeType === 'llm')).toHaveLength(2)
  })
})
