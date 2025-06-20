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

export const getDescendantNodeIds = <TData>(
  nodes: Node<TData>[],
  parentNodeId: string,
): string[] => {
  const descendants: string[] = []
  const queue = [parentNodeId]

  while (queue.length) {
    const currentNodeId = queue.shift()
    if (!currentNodeId)
      continue

    nodes.forEach((node) => {
      if (node.parentId === currentNodeId) {
        descendants.push(node.id)
        queue.push(node.id)
      }
    })
  }

  return descendants
}

export const removeNodeById = <TData>(
  nodes: Node<TData>[],
  nodeId: string,
) => {
  const removedNodeIds = new Set([nodeId, ...getDescendantNodeIds(nodes, nodeId)])
  return nodes.filter(node => !removedNodeIds.has(node.id))
}

export const removeConnectedEdges = <TData>(
  edges: Edge<TData>[],
  nodeIds: string | string[],
) => {
  const removedNodeIds = new Set(Array.isArray(nodeIds) ? nodeIds : [nodeIds])
  return edges.filter(edge => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target))
}
