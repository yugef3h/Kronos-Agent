import { useCallback } from 'react';
import { getConnectedEdges, type Node, type NodeMouseHandler, useStoreApi } from 'reactflow';
import { produce } from 'immer'

export const useNodesInteractions = () => {
  const store = useStoreApi();

  const handleNodeSelect = useCallback(
    (nodeId: string, cancelSelection?: boolean) => {
      const { getNodes, setNodes, edges, setEdges } = store.getState();

      const nodes = getNodes();
      const selectedNode = nodes.find((node) => node.data.selected);

      if (!cancelSelection && selectedNode?.id === nodeId) return;

      const newNodes = produce(nodes, (draft) => {
        draft.forEach((node) => {
          if (node.id === nodeId) node.data.selected = !cancelSelection;
          else node.data.selected = false;
        });
      });
      setNodes(newNodes);

      const connectedEdges = getConnectedEdges([{ id: nodeId } as Node], edges).map(
        (edge) => edge.id,
      );
      const newEdges = produce(edges, (draft) => {
        draft.forEach((edge) => {
          if (connectedEdges.includes(edge.id)) {
            edge.data = {
              ...edge.data,
              _connectedNodeIsSelected: !cancelSelection,
            };
          } else {
            edge.data = {
              ...edge.data,
              _connectedNodeIsSelected: false,
            };
          }
        });
      });
      setEdges(newEdges);

    },
    [store],
  );

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      handleNodeSelect(node.id);
    },
    [handleNodeSelect],
  );

  const handlePaneClick = useCallback(
    () => {
      handleNodeSelect('', true)
    },
    [handleNodeSelect],
  )

  return {
    handleNodeClick,
    handlePaneClick,
  };
};
