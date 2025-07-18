import type { Node } from 'reactflow'
import type { CanvasNodeData } from '../types/canvas'
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