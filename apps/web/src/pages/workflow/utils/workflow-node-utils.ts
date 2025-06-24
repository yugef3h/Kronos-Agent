import type { Node } from 'reactflow';
import type { NodeItem } from '../compts/search-box';
import type { CanvasNodeData } from '../types/canvas';
import {
  ITERATION_CHILDREN_Z_INDEX,
  NODE_WIDTH_X_OFFSET,
} from '../constants';
import {
  buildContainerEndNodeData,
  buildContainerChildPosition,
  isContainerNodeKind,
} from '../features/container-panel/canvas';
import { buildCanvasNodeData } from './workflow-dsl';

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
): Node<CanvasNodeData> => {
  const nextNodeId = createNodeId(node.kind);
  const isNestedNode = Boolean(sourceNode.parentId);
  const nextPosition = isNestedNode
    ? buildContainerChildPosition(index)
    : {
        x: sourceNode.position.x + NODE_WIDTH_X_OFFSET,
        y: sourceNode.position.y + index * 120,
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