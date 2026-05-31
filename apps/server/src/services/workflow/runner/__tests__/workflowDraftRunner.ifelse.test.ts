jest.mock('../rag/knowledgeFacade.js', () => ({
  runKnowledgeRetrievalQuery: jest.fn(),
}))

import { NodeRunStatus } from '../../types.js'
import { registerBuiltInNodeExecutors } from '../../registerNodeExecutors.js'
import { workflowRunStore } from '../../workflowRunStore.js'
import { runWorkflowDraftGraph } from '../../workflowDraftRunner.js'
import { buildExecutionGraph } from '../../buildExecutionGraph.js'
import type { WorkflowDraftDslGraph } from '../../workflowDsl.js'

const createIfElseBranchGraph = (): WorkflowDraftDslGraph => {
  const nodes = [
    { id: 'start-1', data: { type: 'start', variables: [] } },
    {
      id: 'if-1',
      data: {
        type: 'if-else',
        cases: [
          {
            case_id: 'true',
            logical_operator: 'and',
            conditions: [{
              id: 'c1',
              variable_selector: ['sys', 'query'],
              comparison_operator: 'is_not_empty',
              value: '',
            }],
          },
        ],
      },
    },
    { id: 'llm-true', data: { type: 'llm', model: { provider: 'virtual', name: 'zhiling', mode: 'chat' }, promptTemplate: [{ id: 'p1', role: 'user', text: 'yes' }] } },
    { id: 'llm-false', data: { type: 'llm', model: { provider: 'virtual', name: 'zhiling', mode: 'chat' }, promptTemplate: [{ id: 'p1', role: 'user', text: 'no' }] } },
    { id: 'end-1', data: { type: 'end' } },
  ]

  return {
    nodes,
    edges: [
      { source: 'start-1', target: 'if-1', sourceHandle: 'out' },
      { source: 'if-1', target: 'llm-true', sourceHandle: 'true' },
      { source: 'if-1', target: 'llm-false', sourceHandle: 'false' },
      { source: 'llm-true', target: 'end-1', sourceHandle: 'out' },
      { source: 'llm-false', target: 'end-1', sourceHandle: 'out' },
    ],
    nodeById: new Map(nodes.map((node) => [node.id, node])),
  }
}

jest.mock('./debug/llmNodeDebugExecutor.js', () => ({
  executeLlmNodeDebug: jest.fn(async (request: { node: { id: string } }) => ({
    nodeId: request.node.id,
    status: NodeRunStatus.Succeeded,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    elapsedMs: 1,
    outputs: { text: request.node.id },
  })),
}))

describe('workflowDraftRunner if-else branch', () => {
  beforeEach(async () => {
    await workflowRunStore.clear()
    registerBuiltInNodeExecutors()
  })

  it('follows matched if-else branch only', async () => {
    const dslGraph = createIfElseBranchGraph()
    const built = buildExecutionGraph(dslGraph)
    expect(built.ok).toBe(true)
    if (!built.ok) {
      return
    }

    const result = await runWorkflowDraftGraph({
      appId: 'wf_test',
      graph: dslGraph,
      executionGraph: built.graph,
      inputs: { query: '有内容' },
    })

    const executedTypes = result.nodeRuns.map((run) => run.nodeType)
    expect(executedTypes).toContain('if-else')
    expect(executedTypes).toContain('llm')
    expect(executedTypes.filter((type) => type === 'llm')).toHaveLength(1)
    expect(result.nodeRuns.find((run) => run.nodeType === 'llm')?.outputs?.text).toBe('llm-true')
  })
})
