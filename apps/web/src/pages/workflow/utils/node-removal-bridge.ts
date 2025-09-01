import { MarkerType, type Node } from 'reactflow';
import { ITERATION_CHILDREN_Z_INDEX, CUSTOM_EDGE } from '../layout-constants';
import { getContainerBlockEnum } from '../features/container-panel/canvas';
import type { CanvasNodeData } from '../types/canvas';
import type { Edge } from '../types/common';
import { createWorkflowEdgeData } from './edge-data';
import { getContainerScopeData } from './workflow-node-utils';

const AUTO_BRIDGEABLE_NODE_KINDS: CanvasNodeData['kind'][] = ['llm', 'knowledge'];

type ResolveBridgeEdgeOptions = {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  removedNodeId: string;
  removedNodeIds?: string[];
};

export const resolveBridgeEdgeAfterNodeRemoval = ({
  nodes,
  edges,
  removedNodeId,
  removedNodeIds = [removedNodeId],
}: ResolveBridgeEdgeOptions): Edge | null => {
  const removedNode = nodes.find((node) => node.id === removedNodeId);
  if (!removedNode) {
    return null;
  }

  if (!AUTO_BRIDGEABLE_NODE_KINDS.includes(removedNode.data.kind)) {
    return null;
  }

  if (removedNodeIds.length > 1) {
    return null;
  }

  const removedNodeIdSet = new Set(removedNodeIds);
  const incomingEdges = edges.filter(
    (edge) => edge.target === removedNodeId && !removedNodeIdSet.has(edge.source),
  );
  const outgoingEdges = edges.filter(
    (edge) => edge.source === removedNodeId && !removedNodeIdSet.has(edge.target),
  );

  if (incomingEdges.length !== 1 || outgoingEdges.length !== 1) {
    return null;
  }

  const incomingEdge = incomingEdges[0];
  const outgoingEdge = outgoingEdges[0];
  const sourceHandle = incomingEdge.sourceHandle ?? 'out';
  const targetHandle = outgoingEdge.targetHandle ?? 'in';

  if (sourceHandle !== 'out' || targetHandle !== 'in') {
    return null;
  }

  const sourceNode = nodes.find((node) => node.id === incomingEdge.source);
  const targetNode = nodes.find((node) => node.id === outgoingEdge.target);
  if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) {
    return null;
  }

  if (
    sourceNode.parentId !== removedNode.parentId
    || targetNode.parentId !== removedNode.parentId
    || sourceNode.parentId !== targetNode.parentId
  ) {
    return null;
  }

  const sourceType = getContainerBlockEnum(sourceNode.data.kind);
  const targetType = getContainerBlockEnum(targetNode.data.kind);

  if (!sourceType || !targetType) {
    return null;
  }

  const edgeId = `${sourceNode.id}-${sourceHandle}-${targetNode.id}-${targetHandle}`;
  if (edges.some((edge) => edge.id === edgeId)) {
    return null;
  }

  return {
    id: edgeId,
    type: CUSTOM_EDGE,
    source: sourceNode.id,
    target: targetNode.id,
    sourceHandle,
    targetHandle,
    zIndex: sourceNode.parentId ? ITERATION_CHILDREN_Z_INDEX + 2 : undefined,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#94a3b8',
    },
    style: {
      stroke: '#94a3b8',
      strokeWidth: 1.6,
    },
    data: createWorkflowEdgeData({
      sourceType,
      targetType,
      ...getContainerScopeData(nodes, sourceNode),
    }),
  };
};