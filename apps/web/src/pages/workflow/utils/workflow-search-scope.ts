import type { Node } from 'reactflow'
import type { CanvasNodeData } from '../types/canvas'

export const resolveSearchBoxScope = (
  nodes: Node<CanvasNodeData>[],
  node: Node<CanvasNodeData> | undefined,
): 'root' | 'iteration' | 'loop' => {
  if (!node?.parentId) {
    return 'root'
  }

  const containerNode = nodes.find(candidate => candidate.id === node.parentId)
  if (containerNode?.data.kind === 'iteration') {
    return 'iteration'
  }

  if (containerNode?.data.kind === 'loop') {
    return 'loop'
  }

  return 'root'
}