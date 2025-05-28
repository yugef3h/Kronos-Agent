import type { Edge, Node } from 'reactflow'

type SelectableNodeData = {
  selected?: boolean
}

type SelectableEdgeData = {
  _connectedNodeIsSelected?: boolean
}

export const applyNodeSelection = <TData extends SelectableNodeData>(
  nodes: Node<TData>[],
  selectedNodeId?: string,
) => nodes.map(node => ({
  ...node,
  data: {
    ...node.data,
    selected: selectedNodeId ? node.id === selectedNodeId : false,
  },
}))

export const applyConnectedEdgeSelection = <TData extends SelectableEdgeData>(
  edges: Edge<TData>[],
  selectedNodeId?: string,
) => edges.map(edge => ({
  ...edge,
  data: {
    ...(edge.data ?? {}),
    _connectedNodeIsSelected: !!selectedNodeId
      && (edge.source === selectedNodeId || edge.target === selectedNodeId),
  } as TData,
}))

export const removeNodeById = <TData>(
  nodes: Node<TData>[],
  nodeId: string,
) => nodes.filter(node => node.id !== nodeId)

export const removeConnectedEdges = <TData>(
  edges: Edge<TData>[],
  nodeId: string,
) => edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId)
