jest.mock('../rag/knowledgeFacade.js', () => ({
  runKnowledgeRetrievalQuery: jest.fn(),
}))

import { WorkflowRunStatus } from './types.js'
import { registerBuiltInNodeExecutors } from './registerNodeExecutors.js'
import { workflowRunStore } from './workflowRunStore.js'
import { runWorkflowDraftGraph } from './workflowDraftRunner.js'
import { buildExecutionGraph } from './buildExecutionGraph.js'
import type { WorkflowDraftDslGraph } from './workflowDsl.js'

const createStartEndGraph = (): WorkflowDraftDslGraph => {
  const nodes = [
    {
      id: 'start-1',
      data: {
        type: 'start',
        variables: [],
      },
    },
    {
      id: 'end-1',
      data: { type: 'end' },
    },
  ]

  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  return {
    nodes,
    edges: [{ source: 'start-1', target: 'end-1' }],
    nodeById,
  }
}

describe('workflowDraftRunner', () => {
  beforeEach(() => {
    workflowRunStore.clear()
    registerBuiltInNodeExecutors()
  })

  it('runs start node and finishes draft workflow', async () => {
    const dslGraph = createStartEndGraph()
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

    expect(result.run.status).toBe(WorkflowRunStatus.Succeeded)
    expect(result.nodeRuns).toHaveLength(2)
    expect(result.nodeRuns[0]?.nodeType).toBe('start')
    expect(result.nodeRuns[0]?.outputs?.query).toBe('hello')
    expect(result.nodeRuns[1]?.nodeType).toBe('end')
  })
})
