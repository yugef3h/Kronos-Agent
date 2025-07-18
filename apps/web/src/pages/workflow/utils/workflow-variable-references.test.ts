import type { Node } from 'reactflow'
import type { CanvasNodeData } from '../types/canvas'
import { rewriteNodesVariableReferences } from './workflow-variable-references'

const createNode = (id: string, kind: CanvasNodeData['kind'], inputs?: Record<string, unknown>): Node<CanvasNodeData> => ({
  id,
  type: 'workflow',
  position: { x: 0, y: 0 },
  data: {
    kind,
    title: id,
    subtitle: id,
    inputs,
    outputs: {},
  },
})

describe('workflow-variable-references', () => {
  it('renames downstream selector references across different panel configs', () => {
    const nodes = rewriteNodesVariableReferences([
      createNode('trigger-1', 'trigger'),
      createNode('llm-1', 'llm', {
        context: {
          variableSelector: ['trigger-1', 'city'],
        },
      }),
      createNode('end-1', 'end', {
        outputs: [{
          id: 'o1',
          variable: 'answer',
          value_selector: ['trigger-1', 'city'],
          variable_type: 'variable',
          constant_type: 'string',
          value: '',
        }],
      }),
    ], ['trigger-1', 'city'], ['trigger-1', 'destination'], 'trigger-1')

    expect((nodes[1].data.inputs as any).context.variableSelector).toEqual(['trigger-1', 'destination'])
    expect((nodes[2].data.inputs as any).outputs[0].value_selector).toEqual(['trigger-1', 'destination'])
  })

  it('clears downstream selector references when a start variable is removed', () => {
    const nodes = rewriteNodesVariableReferences([
      createNode('trigger-1', 'trigger'),
      createNode('iteration-1', 'iteration', {
        iterator_selector: ['trigger-1', 'items'],
        output_selector: ['trigger-1', 'items'],
      }),
    ], ['trigger-1', 'items'], null, 'trigger-1')

    expect((nodes[1].data.inputs as any).iterator_selector).toEqual([])
    expect((nodes[1].data.inputs as any).output_selector).toEqual([])
  })
})