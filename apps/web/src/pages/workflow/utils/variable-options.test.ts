import { buildWorkflowVariableOptions } from './variable-options'
import type { CanvasNodeData } from '../types/canvas'

const createNodeData = (
  kind: CanvasNodeData['kind'],
  overrides: Partial<CanvasNodeData> = {},
): CanvasNodeData => ({
  kind,
  title: overrides.title ?? kind,
  subtitle: overrides.subtitle ?? kind,
  selected: false,
  inputs: overrides.inputs,
  outputs: overrides.outputs,
  _children: overrides._children,
  _datasets: overrides._datasets,
  _targetBranches: overrides._targetBranches,
  _connectedSourceHandleIds: overrides._connectedSourceHandleIds,
})

describe('buildWorkflowVariableOptions', () => {
  it('uses explicit output types from node inputs metadata', () => {
    const options = buildWorkflowVariableOptions('end-1', [
      {
        id: 'llm-1',
        data: createNodeData('llm', {
          title: 'LLM',
          inputs: {
            _outputTypes: {
              text: 'string',
              structured_output: 'object',
            },
          },
          outputs: {
            text: '',
            structured_output: {},
          },
        }),
      },
      {
        id: 'end-1',
        data: createNodeData('end', { title: 'End', outputs: { result: '' } }),
      },
    ])

    expect(options).toEqual(expect.arrayContaining([
      expect.objectContaining({ valueSelector: ['llm-1', 'text'], valueType: 'string' }),
      expect.objectContaining({ valueSelector: ['llm-1', 'structured_output'], valueType: 'object' }),
      expect.objectContaining({ valueSelector: ['sys', 'query'], valueType: 'string' }),
    ]))
  })

  it('limits nested nodes to root vars plus same-container vars', () => {
    const options = buildWorkflowVariableOptions('child-2', [
      {
        id: 'root-1',
        data: createNodeData('llm', { title: 'Root LLM', outputs: { text: '' } }),
      },
      {
        id: 'iteration-1',
        data: createNodeData('iteration', { title: 'Iteration', outputs: { items: [], count: 0 } }),
      },
      {
        id: 'child-1',
        parentId: 'iteration-1',
        data: createNodeData('llm', { title: 'Sibling LLM', outputs: { text: '' } }),
      },
      {
        id: 'child-2',
        parentId: 'iteration-1',
        data: createNodeData('knowledge', { title: 'Current Node', outputs: { result: [] } }),
      },
      {
        id: 'other-child',
        parentId: 'other-container',
        data: createNodeData('llm', { title: 'Other Child', outputs: { text: '' } }),
      },
    ])

    expect(options.map(option => option.valueSelector.join('.'))).toEqual(expect.arrayContaining([
      'sys.query',
      'root-1.text',
      'iteration-1.items',
      'iteration-1.count',
      'child-1.text',
    ]))
    expect(options.map(option => option.valueSelector.join('.'))).not.toContain('other-child.text')
    expect(options.map(option => option.valueSelector.join('.'))).not.toContain('child-2.result')
  })
})