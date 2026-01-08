import type { Edge, Node } from 'reactflow'
import { BlockEnum } from '../types/common'
import {
  applyConnectedEdgeSelection,
  applyNodeSelection,
  removeConnectedEdges,
  removeNodeById,
} from './node-selection'

type TestNodeData = {
  title: string
  selected?: boolean
}

type TestEdgeData = {
  sourceType: BlockEnum
  targetType: BlockEnum
  _connectedNodeIsSelected?: boolean
}

describe('node-selection', () => {
  it('selects only the active node', () => {
    const nodes: Node<TestNodeData>[] = [
      {
        id: 'start',
        position: { x: 0, y: 0 },
        data: { title: 'Start', selected: true },
      },
      {
        id: 'agent',
        position: { x: 320, y: 0 },
        data: { title: 'LLM', selected: false },
      },
    ]

    const nextNodes = applyNodeSelection(nodes, 'agent')

    expect(nextNodes[0].data.selected).toBe(false)
    expect(nextNodes[1].data.selected).toBe(true)
  })

  it('clears node and edge selection when panel is closed explicitly', () => {
    const nodes: Node<TestNodeData>[] = [
      {
        id: 'start',
        position: { x: 0, y: 0 },
        data: { title: 'Start', selected: false },
      },
      {
        id: 'agent',
        position: { x: 320, y: 0 },
        data: { title: 'LLM', selected: true },
      },
    ]
    const edges: Edge<TestEdgeData>[] = [
      {
        id: 'edge-start-agent',
        source: 'start',
        target: 'agent',
        data: {
          sourceType: BlockEnum.Start,
          targetType: BlockEnum.LLM,
          _connectedNodeIsSelected: true,
        },
      },
    ]

    const nextNodes = applyNodeSelection(nodes)
    const nextEdges = applyConnectedEdgeSelection(edges)

    expect(nextNodes.every(node => !node.data.selected)).toBe(true)
    expect(nextEdges[0].data?._connectedNodeIsSelected).toBe(false)
  })

  it('removes the node and all connected edges', () => {
    const nodes: Node<TestNodeData>[] = [
      {
        id: 'start',
        position: { x: 0, y: 0 },
        data: { title: 'Start', selected: false },
      },
      {
        id: 'agent',
        position: { x: 320, y: 0 },
        data: { title: 'LLM', selected: true },
      },
      {
        id: 'end',
        position: { x: 640, y: 0 },
        data: { title: 'End', selected: false },
      },
    ]
    const edges: Edge<TestEdgeData>[] = [
      {
        id: 'edge-start-agent',
        source: 'start',
        target: 'agent',
        data: {
          sourceType: BlockEnum.Start,
          targetType: BlockEnum.LLM,
        },
      },
      {
        id: 'edge-agent-end',
        source: 'agent',
        target: 'end',
        data: {
          sourceType: BlockEnum.LLM,
          targetType: BlockEnum.End,
        },
      },
    ]

    const nextNodes = removeNodeById(nodes, 'agent')
    const nextEdges = removeConnectedEdges(edges, 'agent')

    expect(nextNodes.map(node => node.id)).toEqual(['start', 'end'])
    expect(nextEdges).toHaveLength(0)
  })
})
