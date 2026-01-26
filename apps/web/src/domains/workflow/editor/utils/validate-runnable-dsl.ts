import type {
  LegacyWorkflowDSL,
  LegacyWorkflowNode,
  WorkflowDSL,
  WorkflowGraphNode,
  WorkflowGraphNodeSemanticType,
} from '../../app/workflowAppStore'
import type { ContainerKind } from '../panels/container-panel/runtime'
import { normalizeIterationNodeConfig } from '../panels/iteration-panel/schema'
import { normalizeLoopNodeConfig } from '../panels/loop-panel/schema'
import { getWorkflowDslEdges, getWorkflowDslNodes } from './workflow-dsl'

type AnyWorkflowDSL = WorkflowDSL | LegacyWorkflowDSL

export type RunnableDslIssueCode =
  | 'missing_start'
  | 'multiple_start'
  | 'missing_end'
  | 'start_not_reachable_end'
  | 'container_entry_without_parent'
  | 'container_invalid_child_parent'
  | 'container_edge_crosses_boundary'
  | 'container_missing_inner_start'
  | 'container_multiple_inner_start'
  | 'container_missing_inner_end'
  | 'container_inner_start_not_reachable_end'
  | 'container_start_node_mismatch'

export type RunnableDslIssue = {
  code: RunnableDslIssueCode
  message: string
  nodeId?: string
}

export type ValidateRunnableDslResult = {
  runnable: boolean
  issues: RunnableDslIssue[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isLegacyNode = (
  node: LegacyWorkflowNode | WorkflowGraphNode,
): node is LegacyWorkflowNode => isRecord(node.data) && ('kind' in node.data || node.type !== 'custom')

const resolveSemanticType = (
  node: LegacyWorkflowNode | WorkflowGraphNode,
): WorkflowGraphNodeSemanticType | null => {
  if (!isLegacyNode(node) && isRecord(node.data) && typeof node.data.type === 'string') {
    return node.data.type as WorkflowGraphNodeSemanticType
  }

  const kind = isRecord(node.data) && typeof node.data.kind === 'string' ? node.data.kind : node.type
  if (kind === 'trigger') return 'start'
  if (kind === 'knowledge') return 'knowledge-retrieval'
  if (kind === 'condition') return 'if-else'
  if (
    kind === 'llm'
    || kind === 'end'
    || kind === 'iteration'
    || kind === 'iteration-start'
    || kind === 'iteration-end'
    || kind === 'loop'
    || kind === 'loop-start'
    || kind === 'loop-end'
  ) {
    return kind as WorkflowGraphNodeSemanticType
  }

  return null
}

const isTopLevelNode = (node: LegacyWorkflowNode | WorkflowGraphNode): boolean => !node.parentId

const collectTopLevelNodeIds = (nodes: Array<LegacyWorkflowNode | WorkflowGraphNode>): Set<string> => {
  return new Set(nodes.filter(isTopLevelNode).map((node) => node.id))
}

const buildAdjacency = (
  edges: ReturnType<typeof getWorkflowDslEdges>,
  allowedNodeIds: Set<string>,
): Map<string, string[]> => {
  const adjacency = new Map<string, string[]>()

  for (const nodeId of allowedNodeIds) {
    adjacency.set(nodeId, [])
  }

  for (const edge of edges) {
    if (!allowedNodeIds.has(edge.source) || !allowedNodeIds.has(edge.target)) {
      continue
    }

    const next = adjacency.get(edge.source) ?? []
    next.push(edge.target)
    adjacency.set(edge.source, next)
  }

  return adjacency
}

const canReachAnyEnd = (
  startId: string,
  endIds: Set<string>,
  adjacency: Map<string, string[]>,
): boolean => {
  if (endIds.has(startId)) {
    return true
  }

  const visited = new Set<string>([startId])
  const queue = [startId]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break

    for (const nextId of adjacency.get(current) ?? []) {
      if (endIds.has(nextId)) {
        return true
      }

      if (visited.has(nextId)) {
        continue
      }

      visited.add(nextId)
      queue.push(nextId)
    }
  }

  return false
}

const CONTAINER_INNER_ENTRY_TYPES: WorkflowGraphNodeSemanticType[] = [
  'iteration-start',
  'iteration-end',
  'loop-start',
  'loop-end',
]

const CONTAINER_SPECS: Record<
  ContainerKind,
  {
    label: string
    startType: WorkflowGraphNodeSemanticType
    endType: WorkflowGraphNodeSemanticType
  }
> = {
  iteration: {
    label: '迭代',
    startType: 'iteration-start',
    endType: 'iteration-end',
  },
  loop: {
    label: '循环',
    startType: 'loop-start',
    endType: 'loop-end',
  },
}

const getNodeScopeKey = (node: LegacyWorkflowNode | WorkflowGraphNode): string =>
  node.parentId ?? '__root__'

const readContainerStartNodeId = (
  containerKind: ContainerKind,
  node: LegacyWorkflowNode | WorkflowGraphNode,
): string => {
  if (containerKind === 'iteration') {
    return normalizeIterationNodeConfig(node.data, node.id).start_node_id
  }

  return normalizeLoopNodeConfig(node.data, node.id).start_node_id
}

const validateContainerSubgraph = (
  containerKind: ContainerKind,
  containerNode: LegacyWorkflowNode | WorkflowGraphNode,
  nodes: Array<LegacyWorkflowNode | WorkflowGraphNode>,
  edges: ReturnType<typeof getWorkflowDslEdges>,
  issues: RunnableDslIssue[],
) => {
  const spec = CONTAINER_SPECS[containerKind]
  const childNodes = nodes.filter((node) => node.parentId === containerNode.id)
  const childIds = new Set(childNodes.map((node) => node.id))
  const innerStartNodes = childNodes.filter((node) => resolveSemanticType(node) === spec.startType)
  const innerEndNodes = childNodes.filter((node) => resolveSemanticType(node) === spec.endType)
  const expectedStartId = readContainerStartNodeId(containerKind, containerNode)

  if (!innerStartNodes.length) {
    issues.push({
      code: 'container_missing_inner_start',
      message: `${spec.label}节点缺少内部开始节点`,
      nodeId: containerNode.id,
    })
  }

  if (innerStartNodes.length > 1) {
    issues.push({
      code: 'container_multiple_inner_start',
      message: `${spec.label}节点只能有一个内部开始节点`,
      nodeId: containerNode.id,
    })
  }

  if (!innerEndNodes.length) {
    issues.push({
      code: 'container_missing_inner_end',
      message: `${spec.label}节点缺少内部结束节点`,
      nodeId: containerNode.id,
    })
  }

  if (expectedStartId && !childIds.has(expectedStartId)) {
    issues.push({
      code: 'container_start_node_mismatch',
      message: `${spec.label}节点配置的内部入口不存在`,
      nodeId: containerNode.id,
    })
  }

  if (innerStartNodes.length === 1 && innerEndNodes.length > 0) {
    const startId = innerStartNodes[0].id
    const endIds = new Set(innerEndNodes.map((node) => node.id))
    const adjacency = buildAdjacency(edges, childIds)

    if (!canReachAnyEnd(startId, endIds, adjacency)) {
      issues.push({
        code: 'container_inner_start_not_reachable_end',
        message: `${spec.label}节点内部开始无法到达内部结束`,
        nodeId: containerNode.id,
      })
    }
  }
}

const validateContainerBoundaries = (
  nodes: Array<LegacyWorkflowNode | WorkflowGraphNode>,
  edges: ReturnType<typeof getWorkflowDslEdges>,
  issues: RunnableDslIssue[],
) => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  for (const node of nodes) {
    const semanticType = resolveSemanticType(node)
    if (semanticType && CONTAINER_INNER_ENTRY_TYPES.includes(semanticType) && !node.parentId) {
      issues.push({
        code: 'container_entry_without_parent',
        message: '容器内部节点必须位于迭代/循环节点内',
        nodeId: node.id,
      })
    }
  }

  for (const node of nodes) {
    if (!node.parentId) {
      continue
    }

    const parent = nodeById.get(node.parentId)
    if (!parent) {
      issues.push({
        code: 'container_invalid_child_parent',
        message: '节点引用了不存在的父容器',
        nodeId: node.id,
      })
      continue
    }

    const parentType = resolveSemanticType(parent)
    if (parentType !== 'iteration' && parentType !== 'loop') {
      issues.push({
        code: 'container_invalid_child_parent',
        message: '节点父级必须是迭代或循环节点',
        nodeId: node.id,
      })
    }
  }

  for (const edge of edges) {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target) {
      continue
    }

    if (getNodeScopeKey(source) !== getNodeScopeKey(target)) {
      issues.push({
        code: 'container_edge_crosses_boundary',
        message: '连线不能跨越容器边界',
        nodeId: edge.id,
      })
    }
  }
}

/** Validates main graph connectivity and loop/iteration container subgraphs. */
export const validateRunnableDsl = (dsl: AnyWorkflowDSL): ValidateRunnableDslResult => {
  const nodes = getWorkflowDslNodes(dsl)
  const edges = getWorkflowDslEdges(dsl)
  const topLevelNodeIds = collectTopLevelNodeIds(nodes)
  const topLevelNodes = nodes.filter((node) => topLevelNodeIds.has(node.id))

  const startNodes = topLevelNodes.filter((node) => resolveSemanticType(node) === 'start')
  const endNodes = topLevelNodes.filter((node) => resolveSemanticType(node) === 'end')

  const issues: RunnableDslIssue[] = []

  if (!startNodes.length) {
    issues.push({
      code: 'missing_start',
      message: '工作流缺少开始节点',
    })
  }

  if (startNodes.length > 1) {
    issues.push({
      code: 'multiple_start',
      message: '工作流只能有一个开始节点',
      nodeId: startNodes[1]?.id,
    })
  }

  if (!endNodes.length) {
    issues.push({
      code: 'missing_end',
      message: '工作流缺少结束节点',
    })
  }

  if (startNodes.length === 1 && endNodes.length > 0) {
    const startId = startNodes[0].id
    const endIds = new Set(endNodes.map((node) => node.id))
    const adjacency = buildAdjacency(edges, topLevelNodeIds)

    if (!canReachAnyEnd(startId, endIds, adjacency)) {
      issues.push({
        code: 'start_not_reachable_end',
        message: '开始节点无法到达任何结束节点',
        nodeId: startId,
      })
    }
  }

  validateContainerBoundaries(nodes, edges, issues)

  for (const node of topLevelNodes) {
    const semanticType = resolveSemanticType(node)
    if (semanticType === 'iteration') {
      validateContainerSubgraph('iteration', node, nodes, edges, issues)
    } else if (semanticType === 'loop') {
      validateContainerSubgraph('loop', node, nodes, edges, issues)
    }
  }

  return {
    runnable: issues.length === 0,
    issues,
  }
}
