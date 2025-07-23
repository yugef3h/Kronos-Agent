import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Node } from 'reactflow';
import type { CanvasNodeData } from '../types/canvas';
import type { Edge } from '../types/common';
import { ITERATION_CHILDREN_Z_INDEX } from '../layout-constants';
import {
  buildContainerChildSummaries,
  getContainerChildNodeHeight,
  buildContainerLayout,
  buildContainerStartNode,
  CONTAINER_END_NODE_WIDTH,
  CONTAINER_NODE_MIN_HEIGHT,
  CONTAINER_NODE_TOP_PADDING,
  CONTAINER_NODE_WIDTH,
  CONTAINER_START_NODE_COLLAPSED_WIDTH,
  CONTAINER_START_NODE_WIDTH,
  isContainerEndKind,
  isContainerStartKind,
} from '../features/container-panel/canvas';
import { normalizeIterationNodeConfig } from '../features/iteration-panel/schema';
import { normalizeLoopNodeConfig } from '../features/loop-panel/schema';
import {
  areContainerChildrenEqual,
  resolveIterationItemValueType,
} from '../utils/workflow-node-utils';

type UseContainerNodeSyncOptions = {
  nodes: Node<CanvasNodeData>[]
  edges: Edge[]
  setNodes: Dispatch<SetStateAction<Node<CanvasNodeData>[]>>
  updateNodeInternals: (id: string) => void
}

const upsertContainerNode = (
  nextNodes: Node<CanvasNodeData>[],
  candidate: Node<CanvasNodeData>,
  touchedContainerIds: Set<string>,
) => {
  let changed = false;
  const currentIndex = nextNodes.findIndex(node => node.id === candidate.id);
  const normalizedCandidate = currentIndex !== -1 && isContainerStartKind(candidate.data.kind)
    ? (() => {
        const currentNode = nextNodes[currentIndex];
        const shouldRealignLegacyPosition = currentNode.position.x === candidate.position.x
          && currentNode.position.y === CONTAINER_NODE_TOP_PADDING;

        return {
          ...candidate,
          position: shouldRealignLegacyPosition ? candidate.position : currentNode.position,
          draggable: currentNode.draggable ?? true,
          selectable: currentNode.selectable ?? true,
        };
      })()
    : candidate;

  if (currentIndex === -1) {
    nextNodes.push(normalizedCandidate);
    if (normalizedCandidate.parentId) {
      touchedContainerIds.add(normalizedCandidate.parentId);
    }
    return true;
  }

  const currentNode = nextNodes[currentIndex];
  const isSameNode = JSON.stringify({
    parentId: currentNode.parentId,
    position: currentNode.position,
    extent: currentNode.extent,
    draggable: currentNode.draggable,
    selectable: currentNode.selectable,
    data: currentNode.data,
  }) === JSON.stringify({
    parentId: normalizedCandidate.parentId,
    position: normalizedCandidate.position,
    extent: normalizedCandidate.extent,
    draggable: normalizedCandidate.draggable,
    selectable: normalizedCandidate.selectable,
    data: normalizedCandidate.data,
  });

  if (!isSameNode) {
    nextNodes[currentIndex] = {
      ...currentNode,
      ...normalizedCandidate,
    };
    changed = true;
    if (normalizedCandidate.parentId) {
      touchedContainerIds.add(normalizedCandidate.parentId);
    }
  }

  return changed;
};

const syncContainerChildren = (
  nextNodes: Node<CanvasNodeData>[],
  containerNode: Node<CanvasNodeData>,
  startNodeWidth: number,
  touchedContainerIds: Set<string>,
) => {
  let changed = false;

  nextNodes.forEach((candidate, index) => {
    if (candidate.parentId !== containerNode.id) {
      return;
    }

    const currentStyle = candidate.style ?? {};
    const nextStyle = {
      ...currentStyle,
      width: isContainerStartKind(candidate.data.kind)
        ? startNodeWidth
        : isContainerEndKind(candidate.data.kind)
          ? CONTAINER_END_NODE_WIDTH
          : undefined,
      height: getContainerChildNodeHeight(candidate.data.kind),
    };

    if (
      candidate.draggable !== true
      || candidate.zIndex !== ITERATION_CHILDREN_Z_INDEX + 1
      || JSON.stringify(currentStyle) !== JSON.stringify(nextStyle)
    ) {
      nextNodes[index] = {
        ...candidate,
        extent: 'parent',
        draggable: true,
        zIndex: ITERATION_CHILDREN_Z_INDEX + 1,
        style: nextStyle,
      };
      changed = true;
      touchedContainerIds.add(containerNode.id);
    }
  });

  return changed;
};

export const useContainerNodeSync = ({
  nodes,
  edges,
  setNodes,
  updateNodeInternals,
}: UseContainerNodeSyncOptions) => {
  useEffect(() => {
    setNodes((currentNodes) => {
      let changed = false;
      const nextNodes = [...currentNodes];
      const touchedContainerIds = new Set<string>();

      nextNodes
        .filter(node => node.data.kind === 'iteration' || node.data.kind === 'loop')
        .forEach((node) => {
          if (node.data.kind === 'iteration') {
            const normalizedConfig = normalizeIterationNodeConfig(node.data.inputs, node.id);
            const itemValueType = resolveIterationItemValueType(nextNodes, normalizedConfig.iterator_selector);
            const expectedStartNode = buildContainerStartNode({
              containerId: node.id,
              startNodeId: normalizedConfig.start_node_id,
              kind: 'iteration',
              itemValueType,
            });

            changed = upsertContainerNode(nextNodes, expectedStartNode, touchedContainerIds) || changed;

            const containerChildCount = nextNodes.filter(candidate => candidate.parentId === node.id).length;
            const startNodeWidth = containerChildCount <= 1 ? CONTAINER_START_NODE_WIDTH : CONTAINER_START_NODE_COLLAPSED_WIDTH;
            const layout = buildContainerLayout({
              containerId: node.id,
              nodes: nextNodes,
              edges,
            });

            changed = syncContainerChildren(nextNodes, node, startNodeWidth, touchedContainerIds) || changed;

            const nextChildren = buildContainerChildSummaries(nextNodes, node.id);
            const outputs = node.data.outputs ?? {};
            const hasOutputShape = 'items' in outputs && 'count' in outputs;

            if (
              JSON.stringify(node.data.inputs ?? null) !== JSON.stringify(normalizedConfig)
              || !areContainerChildrenEqual(node.data._children ?? [], nextChildren)
              || !hasOutputShape
              || Number(node.style?.width ?? CONTAINER_NODE_WIDTH) !== layout.width
              || Number(node.style?.height ?? CONTAINER_NODE_MIN_HEIGHT) !== layout.height
            ) {
              const nodeIndex = nextNodes.findIndex(candidate => candidate.id === node.id);
              nextNodes[nodeIndex] = {
                ...node,
                zIndex: 1,
                style: {
                  ...(node.style ?? {}),
                  width: layout.width,
                  height: layout.height,
                },
                data: {
                  ...node.data,
                  inputs: normalizedConfig as unknown as Record<string, unknown>,
                  outputs: {
                    items: [],
                    count: 0,
                    ...(node.data.outputs ?? {}),
                  },
                  _children: nextChildren,
                },
              };
              changed = true;
              touchedContainerIds.add(node.id);
            }

            return;
          }

          const normalizedConfig = normalizeLoopNodeConfig(node.data.inputs, node.id);
          const expectedStartNode = buildContainerStartNode({
            containerId: node.id,
            startNodeId: normalizedConfig.start_node_id,
            kind: 'loop',
            loopVariables: normalizedConfig.loop_variables,
          });

          changed = upsertContainerNode(nextNodes, expectedStartNode, touchedContainerIds) || changed;

          const containerChildCount = nextNodes.filter(candidate => candidate.parentId === node.id).length;
          const startNodeWidth = containerChildCount <= 1 ? CONTAINER_START_NODE_WIDTH : CONTAINER_START_NODE_COLLAPSED_WIDTH;
          const layout = buildContainerLayout({
            containerId: node.id,
            nodes: nextNodes,
            edges,
          });

          changed = syncContainerChildren(nextNodes, node, startNodeWidth, touchedContainerIds) || changed;

          const nextChildren = buildContainerChildSummaries(nextNodes, node.id);
          const outputs = node.data.outputs ?? {};
          const hasOutputShape = 'steps' in outputs && 'count' in outputs;

          if (
            JSON.stringify(node.data.inputs ?? null) !== JSON.stringify(normalizedConfig)
            || !areContainerChildrenEqual(node.data._children ?? [], nextChildren)
            || !hasOutputShape
            || Number(node.style?.width ?? CONTAINER_NODE_WIDTH) !== layout.width
            || Number(node.style?.height ?? CONTAINER_NODE_MIN_HEIGHT) !== layout.height
          ) {
            const nodeIndex = nextNodes.findIndex(candidate => candidate.id === node.id);
            nextNodes[nodeIndex] = {
              ...node,
              zIndex: 1,
              style: {
                ...(node.style ?? {}),
                width: layout.width,
                height: layout.height,
              },
              data: {
                ...node.data,
                inputs: normalizedConfig as unknown as Record<string, unknown>,
                outputs: {
                  steps: [],
                  count: 0,
                  ...(node.data.outputs ?? {}),
                },
                _children: nextChildren,
              },
            };
            changed = true;
            touchedContainerIds.add(node.id);
          }
        });

      if (changed && touchedContainerIds.size) {
        requestAnimationFrame(() => {
          Array.from(touchedContainerIds).forEach(containerId => updateNodeInternals(containerId));
        });
      }

      return changed ? nextNodes : currentNodes;
    });
  }, [edges, nodes, setNodes, updateNodeInternals]);
};