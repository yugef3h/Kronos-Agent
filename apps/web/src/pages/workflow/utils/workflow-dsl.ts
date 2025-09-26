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
import { buildLLMNodeOutputs, buildLLMOutputTypes, normalizeLLMNodeConfig } from '../features/llm-panel/schema'
import { createDefaultKnowledgeRetrievalNodeConfig } from '../features/knowledge-retrieval-panel/schema'
import { getKnowledgeDatasetsByIds } from '../features/knowledge-retrieval-panel/dataset-store'
import {
  buildLoopChildren,
  createDefaultLoopNodeConfig,
  normalizeLoopNodeConfig,
} from '../features/loop-panel/schema'

const getDefaultOutputs = (kind: CanvasNodeData['kind'], inputs?: Record<string, unknown>): Record<string, unknown> | undefined => {
  switch (kind) {
    case 'trigger':
      return {
        query: '',
        files: [],
      }
    case 'llm':
      return buildLLMNodeOutputs(normalizeLLMNodeConfig(inputs))
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
  dragHandle: '.workflow-node-drag-surface',
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
): CanvasNodeData => {
  const defaultInputs = partial.inputs ?? getDefaultInputs(partial.kind, partial.nodeId)
  let nextInputs = defaultInputs
  let nextOutputs = partial.outputs ?? getDefaultOutputs(partial.kind, partial.inputs)

  if (partial.kind === 'llm') {
    const normalizedLlmConfig = normalizeLLMNodeConfig(defaultInputs)
    nextInputs = {
      ...normalizedLlmConfig,
      _outputTypes: buildLLMOutputTypes(normalizedLlmConfig),
    } as unknown as Record<string, unknown>
    nextOutputs = buildLLMNodeOutputs(normalizedLlmConfig)
  }

  return {
    kind: partial.kind,
    title: partial.title,
    subtitle: partial.subtitle,
    selected: partial.selected ?? false,
    inputs: nextInputs,
    outputs: nextOutputs,
    _targetBranches: partial.kind === 'condition'
      ? buildIfElseTargetBranches(
          normalizeIfElseNodeConfig(defaultInputs).cases,
        )
      : undefined,
    _datasets: partial.kind === 'knowledge'
      ? getKnowledgeDatasetsByIds(
          Array.isArray((defaultInputs as Record<string, unknown> | undefined)?.dataset_ids)
            ? ((defaultInputs as Record<string, unknown>).dataset_ids as string[])
            : [],
        )
      : undefined,
    _children: partial.kind === 'iteration'
      ? buildIterationChildren(
          normalizeIterationNodeConfig(defaultInputs, partial.nodeId).start_node_id,
        )
      : partial.kind === 'loop'
        ? buildLoopChildren(
            normalizeLoopNodeConfig(defaultInputs, partial.nodeId).start_node_id,
          )
        : undefined,
    _connectedSourceHandleIds: partial._connectedSourceHandleIds ?? [],
  }
}

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
      dragHandle: '.workflow-node-drag-surface',
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