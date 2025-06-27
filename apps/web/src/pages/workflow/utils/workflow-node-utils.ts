import type { Node } from 'reactflow';
import type { NodeItem } from '../compts/search-box';
import type { CanvasNodeData } from '../types/canvas';
import {
  ITERATION_CHILDREN_Z_INDEX,
  NODE_Y_OFFSET,
  X_OFFSET,
  NODE_WIDTH_X_OFFSET,
} from '../constants';
import {
  buildContainerEndNodeData,
  getContainerNodeRenderedWidth,
  isContainerNodeKind,
  isContainerStartKind,
  CONTAINER_START_NODE_COLLAPSED_WIDTH,
} from '../features/container-panel/canvas';
import { buildCanvasNodeData } from './workflow-dsl';

const COLUMN_X_TOLERANCE = 24;
const ROW_Y_TOLERANCE = NODE_Y_OFFSET / 2;

const findAvailableNestedY = (
  nodes: Node<CanvasNodeData>[],
  parentId: string,
  targetX: number,
  preferredY: number,
  sourceNodeId: string,
) => {
  const siblingNodes = nodes.filter(candidate => candidate.parentId === parentId && candidate.id !== sourceNodeId);
  const isOccupied = (candidateY: number) => {
    return siblingNodes.some((candidate) => {
      return Math.abs(candidate.position.x - targetX) <= COLUMN_X_TOLERANCE
        && Math.abs(candidate.position.y - candidateY) < ROW_Y_TOLERANCE;
    });
  };

  if (!isOccupied(preferredY)) {
    return preferredY;
  }

  for (let step = 1; step <= 24; step += 1) {
    const lowerY = preferredY + step * NODE_Y_OFFSET;
    if (!isOccupied(lowerY)) {
      return lowerY;
    }

    const upperY = preferredY - step * NODE_Y_OFFSET;
    if (!isOccupied(upperY)) {
      return upperY;
    }
  }

  return preferredY;
};

export const createNodeId = (kind: CanvasNodeData['kind']): string => {
  const random = Math.random().toString(36).slice(2, 7);
  return `${kind}-${Date.now().toString(36)}-${random}`;
};

export const createNodeData = (node: NodeItem, nodeId: string): CanvasNodeData => {
  if (node.kind === 'iteration-end') {
    const endNodeData = buildContainerEndNodeData('iteration');

    return buildCanvasNodeData({
      nodeId,
      kind: endNodeData.kind,
      title: endNodeData.title,
      subtitle: endNodeData.subtitle,
      inputs: endNodeData.inputs,
      outputs: endNodeData.outputs,
    });
  }

  if (node.kind === 'loop-end') {
    const endNodeData = buildContainerEndNodeData('loop');

    return buildCanvasNodeData({
      nodeId,
      kind: endNodeData.kind,
      title: endNodeData.title,
      subtitle: endNodeData.subtitle,
      inputs: endNodeData.inputs,
      outputs: endNodeData.outputs,
    });
  }

  return buildCanvasNodeData({
    nodeId,
    kind: node.kind,
    title: node.name,
    subtitle: node.id,
  });
};

export const createNodeFromSource = (
  sourceNode: Node<CanvasNodeData>,
  node: NodeItem,
  index: number,
  nodes: Node<CanvasNodeData>[] = [],
): Node<CanvasNodeData> => {
  const nextNodeId = createNodeId(node.kind);
  const isNestedNode = Boolean(sourceNode.parentId);
  const nextPosition = isNestedNode
    ? (() => {
        const targetX = sourceNode.position.x + (isContainerStartKind(sourceNode.data.kind)
          ? CONTAINER_START_NODE_COLLAPSED_WIDTH
          : getContainerNodeRenderedWidth(sourceNode)) + X_OFFSET;

        return {
          x: targetX,
          y: findAvailableNestedY(
            nodes,
            sourceNode.parentId!,
            targetX,
            sourceNode.position.y,
            sourceNode.id,
          ),
        };
      })()
    : {
        x: sourceNode.position.x + NODE_WIDTH_X_OFFSET,
        y: sourceNode.position.y + index * NODE_Y_OFFSET,
      };

  return {
    id: nextNodeId,
    type: 'workflow',
    parentId: sourceNode.parentId,
    extent: sourceNode.parentId ? 'parent' : undefined,
    draggable: sourceNode.parentId ? true : undefined,
    zIndex: sourceNode.parentId ? ITERATION_CHILDREN_Z_INDEX + 1 : undefined,
    position: nextPosition,
    data: createNodeData(node, nextNodeId),
  };
};

export const resolveSearchBoxScope = (
  nodes: Node<CanvasNodeData>[],
  node: Node<CanvasNodeData> | undefined,
): 'root' | 'iteration' | 'loop' => {
  if (!node?.parentId) {
    return 'root';
  }

  const containerNode = nodes.find(candidate => candidate.id === node.parentId);
  if (containerNode?.data.kind === 'iteration') {
    return 'iteration';
  }

  if (containerNode?.data.kind === 'loop') {
    return 'loop';
  }

  return 'root';
};

export const getContainerScopeData = (
  nodes: Node<CanvasNodeData>[],
  node: Node<CanvasNodeData>,
) => {
  if (!node.parentId) {
    return {};
  }

  const containerNode = nodes.find(candidate => candidate.id === node.parentId);
  if (!containerNode || !isContainerNodeKind(containerNode.data.kind)) {
    return {};
  }

  return containerNode.data.kind === 'iteration'
    ? { isInIteration: true, iteration_id: containerNode.id }
    : { isInLoop: true, loop_id: containerNode.id };
};

const hasRecordShape = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

export const resolveIterationItemValueType = (
  nodes: Node<CanvasNodeData>[],
  iteratorSelector: string[],
) => {
  if (iteratorSelector.join('.') === 'sys.files') {
    return 'file' as const;
  }

  const [sourceNodeId, outputKey] = iteratorSelector;
  const sourceNode = nodes.find(node => node.id === sourceNodeId);
  const outputValue = sourceNode?.data.outputs?.[outputKey];

  if (Array.isArray(outputValue) && outputValue.length) {
    const sample = outputValue[0];
    if (typeof sample === 'number')
      return 'number' as const;
    if (typeof sample === 'boolean')
      return 'boolean' as const;
    if (Array.isArray(sample))
      return 'array' as const;
    if (hasRecordShape(sample))
      return 'object' as const;
    if (typeof sample === 'string')
      return 'string' as const;
  }

  return 'object' as const;
};

export const areStringArraysEqual = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length)
    return false;

  return left.every((item, index) => item === right[index]);
};

export const getKnowledgeDatasetIds = (nodeData: CanvasNodeData) => {
  const datasetIds = (nodeData.inputs as { dataset_ids?: unknown } | undefined)?.dataset_ids;
  if (!Array.isArray(datasetIds)) {
    return [];
  }

  return datasetIds.filter((item): item is string => typeof item === 'string');
};

export const areKnowledgeDatasetsEqual = (
  left: CanvasNodeData['_datasets'] = [],
  right: CanvasNodeData['_datasets'] = [],
) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((dataset, index) => {
    const target = right[index];
    return dataset.id === target?.id
      && dataset.name === target.name
      && dataset.updatedAt === target.updatedAt;
  });
};

export const areContainerChildrenEqual = (
  left: CanvasNodeData['_children'] = [],
  right: CanvasNodeData['_children'] = [],
) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((child, index) => {
    const target = right[index];
    return child.nodeId === target?.nodeId && child.nodeType === target.nodeType;
  });
};