import type {
  LegacyWorkflowDSL,
  LegacyWorkflowNode,
  WorkflowDSL,
  WorkflowGraphNode,
  WorkflowGraphNodeSemanticType,
} from '../../app/workflowAppStore'
import { getWorkflowDslEdges, getWorkflowDslNodes } from './workflow-dsl'

type AnyWorkflowDSL = WorkflowDSL | LegacyWorkflowDSL

export type RunnableDslIssueCode =
  | 'missing_start'
  | 'multiple_start'
  | 'missing_end'
  | 'start_not_reachable_end'

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

/** Step 4: validate main graph has a single start, an end, and start→end reachability. */
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

  return {
    runnable: issues.length === 0,
    issues,
  }
}
