import type { Node } from 'reactflow'
import type { WorkflowDSL } from '../../../features/workflow/workflowAppStore'
import type { Edge } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import {
  buildIfElseTargetBranches,
  createDefaultIfElseNodeConfig,
  normalizeIfElseNodeConfig,
} from '../features/ifelse-panel/schema'
import {
  buildIterationChildren,
  createDefaultIterationNodeConfig,
  normalizeIterationNodeConfig,
} from '../features/iteration-panel/schema'
import { createDefaultKnowledgeRetrievalNodeConfig } from '../features/knowledge-retrieval-panel/schema'
import { getKnowledgeDatasetsByIds } from '../features/knowledge-retrieval-panel/dataset-store'
import {
  buildLoopChildren,
  createDefaultLoopNodeConfig,
  normalizeLoopNodeConfig,
} from '../features/loop-panel/schema'

const getDefaultOutputs = (kind: CanvasNodeData['kind']): Record<string, unknown> | undefined => {
  switch (kind) {
    case 'trigger':
      return {
        query: '',
        files: [],
      }
    case 'llm':
      return {
        text: '',
        reasoning_content: '',
        usage: {},
      }
    case 'knowledge':
      return {
        result: [],
        documents: [],
        files: [],
      }
    case 'condition':
      return {
        matched: false,
      }
    case 'iteration':
      return {
        items: [],
        count: 0,
      }
    case 'loop':
      return {
        steps: [],
        count: 0,
      }
    case 'iteration-start':
      return {
        item: {},
        index: 0,
      }
    case 'loop-start':
      return {
        index: 0,
      }
    case 'iteration-end':
      return {
        item: null,
        done: true,
      }
    case 'loop-end':
      return {
        done: true,
      }
    case 'end':
      return {
        result: '',
      }
    default:
      return undefined
  }
}

const getDefaultInputs = (kind: CanvasNodeData['kind'], nodeId?: string): Record<string, unknown> | undefined => {
  switch (kind) {
    case 'condition':
      return createDefaultIfElseNodeConfig() as unknown as Record<string, unknown>
    case 'knowledge':
      return createDefaultKnowledgeRetrievalNodeConfig() as unknown as Record<string, unknown>
    case 'iteration':
      return createDefaultIterationNodeConfig(nodeId) as unknown as Record<string, unknown>
    case 'loop':
      return createDefaultLoopNodeConfig(nodeId) as unknown as Record<string, unknown>
    case 'iteration-start':
      return {
        _outputTypes: {
          item: 'object',
          index: 'number',
        },
      }
    case 'loop-start':
      return {
        _outputTypes: {
          index: 'number',
        },
      }
    case 'iteration-end':
      return {
        _outputTypes: {
          item: 'object',
          done: 'boolean',
        },
      }
    case 'loop-end':
      return {
        _outputTypes: {
          done: 'boolean',
        },
      }
    default:
      return undefined
  }
}

const isCanvasNodeKind = (kind: unknown): kind is CanvasNodeData['kind'] => {
  return ['llm', 'knowledge', 'end', 'condition', 'iteration', 'loop', 'trigger', 'iteration-start', 'iteration-end', 'loop-start', 'loop-end'].includes(
    String(kind),
  )
}

export const createInitialTriggerNode = (): Node<CanvasNodeData> => ({
  id: 'trigger-1',
  type: 'workflow',
  position: { x: 80, y: 282 },
  data: {
    kind: 'trigger',
    title: '用户输入',
    subtitle: '开始',
    selected: false,
    outputs: getDefaultOutputs('trigger'),
  },
})

export const buildCanvasNodeData = (
  partial: Partial<CanvasNodeData> & Pick<CanvasNodeData, 'kind' | 'title' | 'subtitle'> & { nodeId?: string },
): CanvasNodeData => ({
  kind: partial.kind,
  title: partial.title,
  subtitle: partial.subtitle,
  selected: partial.selected ?? false,
  inputs: partial.inputs ?? getDefaultInputs(partial.kind, partial.nodeId),
  outputs: partial.outputs ?? getDefaultOutputs(partial.kind),
  _targetBranches: partial.kind === 'condition'
    ? buildIfElseTargetBranches(
        normalizeIfElseNodeConfig(partial.inputs ?? getDefaultInputs(partial.kind, partial.nodeId)).cases,
      )
    : undefined,
  _datasets: partial.kind === 'knowledge'
    ? getKnowledgeDatasetsByIds(
        Array.isArray((partial.inputs as Record<string, unknown> | undefined)?.dataset_ids)
          ? ((partial.inputs as Record<string, unknown>).dataset_ids as string[])
          : [],
      )
    : undefined,
  _children: partial.kind === 'iteration'
    ? buildIterationChildren(
        normalizeIterationNodeConfig(partial.inputs ?? getDefaultInputs(partial.kind, partial.nodeId), partial.nodeId).start_node_id,
      )
    : partial.kind === 'loop'
      ? buildLoopChildren(
          normalizeLoopNodeConfig(partial.inputs ?? getDefaultInputs(partial.kind, partial.nodeId), partial.nodeId).start_node_id,
        )
      : undefined,
  _connectedSourceHandleIds: partial._connectedSourceHandleIds ?? [],
})

export const hydrateCanvasNodesFromDsl = (dsl: WorkflowDSL): Node<CanvasNodeData>[] => {
  if (!dsl.nodes.length)
    return [createInitialTriggerNode()]

  return dsl.nodes.flatMap((node) => {
    const kind = isCanvasNodeKind(node.data.kind) ? node.data.kind : null
    if (!kind)
      return []

    return [{
      id: node.id,
      type: 'workflow',
      position: node.position,
      parentId: node.parentId,
      data: buildCanvasNodeData({
        nodeId: node.id,
        kind,
        title: typeof node.data.label === 'string' ? node.data.label : '未命名节点',
        subtitle: typeof node.data.subtitle === 'string' ? node.data.subtitle : node.id,
        selected: false,
        inputs: node.data.inputs,
        outputs: node.data.outputs,
      }),
    }]
  })
}

export const createWorkflowDslFromCanvas = (
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  appName?: string,
): WorkflowDSL => ({
  version: '0.1.0',
  nodes: nodes.map(node => ({
    id: node.id,
    type: node.data.kind,
    position: node.position,
    parentId: node.parentId,
    data: {
      kind: node.data.kind,
      label: node.data.title,
      subtitle: node.data.subtitle,
      inputs: node.data.inputs,
      outputs: node.data.outputs,
    },
  })),
  edges: edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    data: edge.data,
  })),
  metadata: {
    appName,
    mode: 'blank-app',
    updatedBy: 'kronos-web',
  },
})