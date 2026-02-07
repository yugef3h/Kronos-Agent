import type { NodeDebugBlockKind } from '../../app/workflowNodeDebugApi'
import type { WorkflowCanvasNodeKind } from '../types/canvas'

const CANVAS_KIND_TO_NODE_DEBUG: Partial<Record<WorkflowCanvasNodeKind, NodeDebugBlockKind>> = {
  trigger: 'start',
  end: 'end',
  llm: 'llm',
  condition: 'if-else',
  knowledge: 'knowledge-retrieval',
  loop: 'loop',
  iteration: 'iteration',
}

export const resolveNodeDebugBlockKind = (
  kind: WorkflowCanvasNodeKind | undefined,
): NodeDebugBlockKind | null => {
  if (!kind) {
    return null
  }

  return CANVAS_KIND_TO_NODE_DEBUG[kind] ?? null
}
