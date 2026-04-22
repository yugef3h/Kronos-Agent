import type { RefObject } from 'react'
import type { ReactFlowInstance } from 'reactflow'

export const focusWorkflowNodeOnCanvas = (
  reactFlowInstanceRef: RefObject<ReactFlowInstance | null>,
  nodeId: string,
) => {
  requestAnimationFrame(() => {
    const instance = reactFlowInstanceRef.current
    const targetNode = instance?.getNode(nodeId)
    if (!instance || !targetNode) {
      return
    }

    instance.fitView({
      nodes: [targetNode],
      padding: 0.35,
      duration: 350,
      maxZoom: 1,
    })
  })
}
