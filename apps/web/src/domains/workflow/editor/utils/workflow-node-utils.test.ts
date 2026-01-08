import type { Node } from 'reactflow'
import type { CanvasNodeData } from '../types/canvas'
import type { Edge } from '../types/common'
import type { NodeItem } from '../types/search-box'
import { X_OFFSET, NODE_WIDTH } from '../layout-constants'
import { createNodeFromSource } from './workflow-node-utils'
import { resolveSearchBoxScope } from './workflow-search-scope'

const createNode = (
  id: string,
  kind: CanvasNodeData['kind'],
  overrides: Partial<Node<CanvasNodeData>> = {},
): Node<CanvasNodeData> => ({
  id,
  type: 'workflow',
  position: { x: 0, y: 0 },
  data: {
    kind,
    title: kind,
    subtitle: kind,
  },
  ...overrides,
})

const createEdge = (id: string, source: string, target: string, sourceHandle = 'out'): Edge => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle: 'in',
})

const createNodeItem = (kind: NodeItem['kind'], name: string): NodeItem => ({
  id: kind,
  kind,
  name,
  icon: null,
})

describe('workflow-node-utils search scope', () => {
  it('keeps root-level container nodes in the root search scope', () => {
    const loopNode = createNode('loop-1', 'loop')
    const iterationNode = createNode('iteration-1', 'iteration')
    const nodes = [loopNode, iterationNode]

    expect(resolveSearchBoxScope(nodes, loopNode)).toBe('root')
    expect(resolveSearchBoxScope(nodes, iterationNode)).toBe('root')
  })

  it('uses the parent container kind for nested child nodes', () => {
    const loopNode = createNode('loop-1', 'loop')
    const iterationNode = createNode('iteration-1', 'iteration')
    const loopChild = createNode('loop-child', 'llm', { parentId: loopNode.id })
    const iterationChild = createNode('iteration-child', 'knowledge', { parentId: iterationNode.id })
    const nodes = [loopNode, iterationNode, loopChild, iterationChild]

    expect(resolveSearchBoxScope(nodes, loopChild)).toBe('loop')
    expect(resolveSearchBoxScope(nodes, iterationChild)).toBe('iteration')
  })

  it('falls back to root when the parent container cannot be resolved', () => {
    const orphanChild = createNode('orphan-child', 'llm', { parentId: 'missing-parent' })

    expect(resolveSearchBoxScope([orphanChild], orphanChild)).toBe('root')
  })
})

describe('createNodeFromSource', () => {
  it('pushes later condition branches below expanded previous branch nodes', () => {
    const conditionNode = createNode('condition-1', 'condition', {
      position: { x: 80, y: 282 },
      data: {
        kind: 'condition',
        title: '条件判断',
        subtitle: 'condition',
        _targetBranches: [
          { id: 'true', name: 'IF' },
          { id: 'false', name: 'ELSE' },
        ],
      },
    })
    const iterationNode = createNode('iteration-1', 'iteration', {
      position: { x: 80 + NODE_WIDTH + X_OFFSET, y: 282 },
      style: { height: 260 },
    })

    const nextNode = createNodeFromSource(
      conditionNode,
      createNodeItem('llm', 'LLM'),
      1,
      [conditionNode, iterationNode],
      [createEdge('condition-true-iteration', conditionNode.id, iterationNode.id, 'true')],
      'false',
    )

    expect(nextNode.position).toEqual({
      x: 80 + NODE_WIDTH + X_OFFSET,
      y: 282 + 260 + 24,
    })
  })

  it('keeps the default branch row spacing when previous branches are compact', () => {
    const conditionNode = createNode('condition-1', 'condition', {
      position: { x: 80, y: 282 },
      data: {
        kind: 'condition',
        title: '条件判断',
        subtitle: 'condition',
        _targetBranches: [
          { id: 'true', name: 'IF' },
          { id: 'false', name: 'ELSE' },
        ],
      },
    })
    const llmNode = createNode('llm-1', 'llm', {
      position: { x: 80 + NODE_WIDTH + X_OFFSET, y: 282 },
      style: { height: 72 },
    })

    const nextNode = createNodeFromSource(
      conditionNode,
      createNodeItem('knowledge', 'Knowledge'),
      1,
      [conditionNode, llmNode],
      [createEdge('condition-true-llm', conditionNode.id, llmNode.id, 'true')],
      'false',
    )

    expect(nextNode.position).toEqual({
      x: 80 + NODE_WIDTH + X_OFFSET,
      y: 282 + 120,
    })
  })
})