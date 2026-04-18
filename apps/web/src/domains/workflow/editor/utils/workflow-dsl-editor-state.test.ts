import type { Node } from 'reactflow'
import type { CanvasNodeData } from '../types/canvas'
import { createWorkflowDslFromCanvas, hydrateCanvasNodesFromDsl } from './workflow-dsl'

describe('workflow-dsl editor state', () => {
  it('does not export panel debug draft into DSL (uses side storage instead)', () => {
    const nodes: Node<CanvasNodeData>[] = [
      {
        id: 'llm-1',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: {
          kind: 'llm',
          title: 'LLM',
          subtitle: '模型',
          inputs: {},
          outputs: {},
          _panelDebugDraft: { 'sys.query': 'persist me' },
        },
      },
    ]

    const dsl = createWorkflowDslFromCanvas(nodes, [])
    const graphNode = dsl.workflow.graph.nodes[0]

    expect(graphNode?.data?.editor).toBeUndefined()
  })

  it('still hydrates legacy DSL editor.panelDebugDraft', () => {
    const dsl = createWorkflowDslFromCanvas(
      [
        {
          id: 'llm-1',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: {
            kind: 'llm',
            title: 'LLM',
            subtitle: '模型',
            inputs: {},
            outputs: {},
          },
        },
      ],
      [],
    )

    dsl.workflow.graph.nodes[0].data = {
      ...dsl.workflow.graph.nodes[0].data,
      editor: {
        panelDebugDraft: { 'sys.query': 'legacy' },
      },
    }

    const restored = hydrateCanvasNodesFromDsl(dsl)

    expect(restored[0]?.data._panelDebugDraft).toEqual({ 'sys.query': 'legacy' })
  })
})
