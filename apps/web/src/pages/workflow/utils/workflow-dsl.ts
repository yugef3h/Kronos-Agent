import type { Node } from 'reactflow'
import type { WorkflowDSL } from '../../../features/workflow/workflowAppStore'
import type { Edge } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import {
  buildIfElseTargetBranches,
  createDefaultIfElseNodeConfig,
  normalizeIfElseNodeConfig,
} from '../features/ifelse-panel/schema'

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
        documents: [],
      }
    case 'condition':
      return {
        matched: false,
      }
    case 'iteration':
      return {
        items: [],
      }
    case 'loop':
      return {
        steps: [],
      }
    case 'end':
      return {
        result: '',
      }
    default:
      return undefined
  }
}

const getDefaultInputs = (kind: CanvasNodeData['kind']): Record<string, unknown> | undefined => {
  switch (kind) {
    case 'condition':
      return createDefaultIfElseNodeConfig() as unknown as Record<string, unknown>
    default:
      return undefined
  }
}

const isCanvasNodeKind = (kind: unknown): kind is CanvasNodeData['kind'] => {
  return ['llm', 'knowledge', 'end', 'condition', 'iteration', 'loop', 'trigger'].includes(
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
  partial: Partial<CanvasNodeData> & Pick<CanvasNodeData, 'kind' | 'title' | 'subtitle'>,
): CanvasNodeData => ({
  kind: partial.kind,
  title: partial.title,
  subtitle: partial.subtitle,
  selected: partial.selected ?? false,
  inputs: partial.inputs ?? getDefaultInputs(partial.kind),
  outputs: partial.outputs ?? getDefaultOutputs(partial.kind),
  _targetBranches: partial.kind === 'condition'
    ? buildIfElseTargetBranches(
        normalizeIfElseNodeConfig(partial.inputs ?? getDefaultInputs(partial.kind)).cases,
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