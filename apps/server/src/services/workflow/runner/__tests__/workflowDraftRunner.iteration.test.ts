jest.mock('../../../../rag/knowledgeFacade.js', () => ({
  runKnowledgeRetrievalQuery: jest.fn(),
}))

jest.mock('./debug/llmNodeDebugExecutor.js', () => ({
  executeLlmNodeDebug: jest.fn(async (request: { node: { id: string } }) => ({
    nodeId: request.node.id,
    status: 'succeeded',
    startedAt: Date.now(),
    finishedAt: Date.now(),
    elapsedMs: 1,
    outputs: { text: request.node.id },
  })),
}))

import { NodeRunStatus } from '../../types/types.js'
import { registerBuiltInNodeExecutors } from '../../executors/registerNodeExecutors.js'
import { workflowRunStore } from '../../store/workflowRunStore.js'
import { runWorkflowDraftGraph } from '../../runner/workflowDraftRunner.js'
import { buildExecutionGraph } from '../../engine/buildExecutionGraph.js'
import type { WorkflowDraftDslGraph } from '../workflowDsl.js'

const createIterationGraph = (): WorkflowDraftDslGraph => {
  const nodes = [
    { id: 'start-1', data: { type: 'start', variables: [] } },
    {
      id: 'iteration-1',
      data: {
        type: 'iteration',
        start_node_id: 'iteration-1__iteration_start',
        iterator_selector: ['start-1', 'topics'],
        output_selector: ['llm-inner', 'text'],
      },
    },
    {
      id: 'iteration-1__iteration_start',
      parentId: 'iteration-1',
      data: { type: 'iteration-start' },
    },
    {
      id: 'llm-inner',
      parentId: 'iteration-1',
      data: {
        type: 'llm',
        model: { provider: 'virtual', name: 'zhiling', mode: 'chat' },
        promptTemplate: [{ id: 'p1', role: 'user', text: '{{#sys.item#}}' }],
      },
    },
    {
      id: 'iteration-1__iteration_end',
      parentId: 'iteration-1',
      data: { type: 'iteration-end' },
    },
    { id: 'end-1', data: { type: 'end' } },
  ]

  return {
    nodes,
    edges: [
      { source: 'start-1', target: 'iteration-1', sourceHandle: 'out' },
      { source: 'iteration-1', target: 'end-1', sourceHandle: 'out' },
      { source: 'iteration-1__iteration_start', target: 'llm-inner', sourceHandle: 'out' },
      { source: 'llm-inner', target: 'iteration-1__iteration_end', sourceHandle: 'out' },
    ],
    nodeById: new Map(nodes.map((node) => [node.id, node])),
  }
}

describe('workflowDraftRunner iteration sandbox', () => {
  beforeEach(async () => {
    await workflowRunStore.clear()
    registerBuiltInNodeExecutors()
  })

  it('runs iteration container for each iterator item', async () => {
    const dslGraph = createIterationGraph()
    const built = buildExecutionGraph(dslGraph)
    expect(built.ok).toBe(true)
    if (!built.ok) {
      return
    }

    const result = await runWorkflowDraftGraph({
      appId: 'wf_test',
      graph: dslGraph,
      executionGraph: built.graph,
      inputs: {
        query: 'hello',
        topics: ['a', 'b'],
      },
    })

    const iterationRun = result.nodeRuns.find((run) => run.nodeType === 'iteration')
    expect(iterationRun?.status).toBe(NodeRunStatus.Succeeded)
    expect(result.nodeRuns.filter((run) => run.nodeType === 'llm')).toHaveLength(2)
  })
})
