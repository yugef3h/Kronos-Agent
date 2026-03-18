import { NodeRunStatus } from './types.js'
import { registerBuiltInNodeExecutors } from './registerNodeExecutors.js'
import { workflowRunStore } from './workflowRunStore.js'
import { runWorkflowDraftGraph } from './workflowDraftRunner.js'
import { buildExecutionGraph } from './buildExecutionGraph.js'
import type { WorkflowDraftDslGraph } from './workflowDsl.js'

const mockRunKnowledgeRetrievalQuery = jest.fn()

jest.mock('../rag/knowledgeFacade.js', () => ({
  runKnowledgeRetrievalQuery: (...args: unknown[]) => mockRunKnowledgeRetrievalQuery(...args),
}))

const createStartKnowledgeEndGraph = (): WorkflowDraftDslGraph => {
  const nodes = [
    { id: 'start-1', data: { type: 'start', variables: [] } },
    {
      id: 'knowledge-1',
      data: {
        type: 'knowledge-retrieval',
        dataset_ids: ['ds-1'],
        query_variable_selector: ['sys', 'query'],
        retrieval_mode: 'multiWay',
      },
    },
    { id: 'end-1', data: { type: 'end' } },
  ]

  return {
    nodes,
    edges: [
      { source: 'start-1', target: 'knowledge-1', sourceHandle: 'out' },
      { source: 'knowledge-1', target: 'end-1', sourceHandle: 'out' },
    ],
    nodeById: new Map(nodes.map((node) => [node.id, node])),
  }
}

describe('workflowDraftRunner knowledge chain', () => {
  beforeEach(async () => {
    await workflowRunStore.clear()
    registerBuiltInNodeExecutors()
    mockRunKnowledgeRetrievalQuery.mockReset()
  })

  it('runs start then knowledge retrieval nodes', async () => {
    mockRunKnowledgeRetrievalQuery.mockResolvedValue({
      query: '什么是 RAG',
      items: [{
        dataset_id: 'ds-1',
        dataset_name: '知识库',
        document_id: 'doc-1',
        document_name: 'doc.txt',
        chunk_id: 'chunk-1',
        chunk_index: 0,
        text: 'RAG 是检索增强生成',
        score: 0.9,
        search_method: 'semantic_search',
        matched_terms: ['RAG'],
        metadata: {},
        token_count: 10,
        char_count: 20,
      }],
      diagnostics: {
        retrieval_mode: 'multiWay',
        dataset_count: 1,
        total_chunk_count: 1,
        filtered_chunk_count: 1,
      },
    })

    const dslGraph = createStartKnowledgeEndGraph()
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

    expect(result.nodeRuns.map((run) => run.nodeType)).toEqual(['start', 'knowledge-retrieval', 'end'])
    expect(result.nodeRuns[1]?.status).toBe(NodeRunStatus.Succeeded)
    expect(mockRunKnowledgeRetrievalQuery).toHaveBeenCalled()
  })
})
