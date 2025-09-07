import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react'
import type { Node, NodeMouseHandler } from 'reactflow';
import type { Edge as WorkflowEdge } from '../types/common'
import { applyConnectedEdgeSelection, applyNodeSelection } from './node-selection'

type SelectableNodeData = {
  selected?: boolean
}

type UseNodesInteractionsOptions<
  TNodeData extends SelectableNodeData,
> = {
  setNodes: Dispatch<SetStateAction<Node<TNodeData>[]>>
  setEdges: Dispatch<SetStateAction<WorkflowEdge[]>>
}

export const useNodesInteractions = <
  TNodeData extends SelectableNodeData,
>({ setNodes, setEdges }: UseNodesInteractionsOptions<TNodeData>) => {
  const ignoreNextNodeClickRef = useRef(false)

  const handleNodeSelect = useCallback(
    (nodeId?: string) => {
      setNodes((currentNodes) => {
        const selectedNode = currentNodes.find((node) => node.data.selected);

        if (nodeId && selectedNode?.id === nodeId)
          return currentNodes

        return applyNodeSelection(currentNodes, nodeId)
      })

      setEdges(currentEdges => applyConnectedEdgeSelection(currentEdges, nodeId))
    },
    [setEdges, setNodes],
  );

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      if (ignoreNextNodeClickRef.current) {
        ignoreNextNodeClickRef.current = false
        return
      }

      handleNodeSelect(node.id);
    },
    [handleNodeSelect],
  );

  const handlePaneClick = useCallback(
    () => {
      return undefined
    },
    [],
  )

  return {
    handleNodeClick,
    handlePanelClose: () => {
      ignoreNextNodeClickRef.current = true
      handleNodeSelect()

      requestAnimationFrame(() => {
        ignoreNextNodeClickRef.current = false
      })
    },
    handlePaneClick,
  };
};
