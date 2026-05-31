import type { NodeDebugBlockKind } from '../types/types.js'

export type WorkflowDslGraphNode = {
  id: string
  parentId?: string
  type?: string
  data?: Record<string, unknown>
}

export type WorkflowDslGraphEdge = {
  id?: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export type WorkflowDslGraph = {
  nodes: WorkflowDslGraphNode[]
  edges: WorkflowDslGraphEdge[]
}

export type ExecutionGraphNode = {
  id: string
  type: NodeDebugBlockKind | 'iteration' | 'iteration-start' | 'iteration-end' | 'loop' | 'loop-start' | 'loop-end'
  parentId?: string
}

export type ExecutionGraphEdge = {
  source: string
  target: string
  sourceHandle?: string
}

export type ExecutionGraph = {
  nodes: Map<string, ExecutionGraphNode>
  adjacency: Map<string, string[]>
  reverseAdjacency: Map<string, string[]>
  outboundEdges: Map<string, ExecutionGraphEdge[]>
  inDegree: Map<string, number>
  startNodeId: string
  endNodeIds: Set<string>
}

export type BuildExecutionGraphIssue = {
  code:
    | 'missing_start'
    | 'multiple_start'
    | 'missing_end'
    | 'unsupported_node_type'
  message: string
  nodeId?: string
}

export type BuildExecutionGraphResult =
  | { ok: true; graph: ExecutionGraph }
  | { ok: false; issues: BuildExecutionGraphIssue[] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const resolveSemanticType = (
  node: WorkflowDslGraphNode,
): ExecutionGraphNode['type'] | null => {
  const dataType = isRecord(node.data) && typeof node.data.type === 'string'
    ? node.data.type
    : null
  if (dataType) {
    return dataType as ExecutionGraphNode['type']
  }

  const kind = isRecord(node.data) && typeof node.data.kind === 'string'
    ? node.data.kind
    : node.type

  if (kind === 'trigger') return 'start'
  if (kind === 'knowledge') return 'knowledge-retrieval'
  if (kind === 'condition') return 'if-else'
  if (
    kind === 'start'
    || kind === 'end'
    || kind === 'llm'
    || kind === 'if-else'
    || kind === 'knowledge-retrieval'
    || kind === 'loop'
    || kind === 'loop-start'
    || kind === 'loop-end'
    || kind === 'iteration'
    || kind === 'iteration-start'
    || kind === 'iteration-end'
  ) {
    return kind as ExecutionGraphNode['type']
  }

  return null
}

const isTopLevelNode = (node: WorkflowDslGraphNode): boolean => !node.parentId

export const buildExecutionGraph = (graph: WorkflowDslGraph): BuildExecutionGraphResult => {
  const topLevelNodes = graph.nodes.filter(isTopLevelNode)
  const allowedIds = new Set(topLevelNodes.map((node) => node.id))
  const issues: BuildExecutionGraphIssue[] = []

  const nodes = new Map<string, ExecutionGraphNode>()
  const startNodeIds: string[] = []
  const endNodeIds = new Set<string>()

  for (const node of topLevelNodes) {
    const type = resolveSemanticType(node)
    if (!type) {
      issues.push({
        code: 'unsupported_node_type',
        message: `Unsupported node type for node ${node.id}`,
        nodeId: node.id,
      })
      continue
    }

    nodes.set(node.id, {
      id: node.id,
      type,
      ...(node.parentId ? { parentId: node.parentId } : {}),
    })

    if (type === 'start') {
      startNodeIds.push(node.id)
    }

    if (type === 'end') {
      endNodeIds.add(node.id)
    }
  }

  if (startNodeIds.length === 0) {
    issues.push({ code: 'missing_start', message: 'Workflow graph is missing a start node' })
  }

  if (startNodeIds.length > 1) {
    issues.push({
      code: 'multiple_start',
      message: 'Workflow graph has multiple start nodes',
      nodeId: startNodeIds[1],
    })
  }

  if (endNodeIds.size === 0) {
    issues.push({ code: 'missing_end', message: 'Workflow graph is missing an end node' })
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  const adjacency = new Map<string, string[]>()
  const reverseAdjacency = new Map<string, string[]>()
  const outboundEdges = new Map<string, ExecutionGraphEdge[]>()
  const inDegree = new Map<string, number>()

  for (const nodeId of allowedIds) {
    adjacency.set(nodeId, [])
    reverseAdjacency.set(nodeId, [])
    outboundEdges.set(nodeId, [])
    inDegree.set(nodeId, 0)
  }

  for (const edge of graph.edges) {
    if (!allowedIds.has(edge.source) || !allowedIds.has(edge.target)) {
      continue
    }

    adjacency.get(edge.source)?.push(edge.target)
    reverseAdjacency.get(edge.target)?.push(edge.source)
    outboundEdges.get(edge.source)?.push({
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
    })
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  return {
    ok: true,
    graph: {
      nodes,
      adjacency,
      reverseAdjacency,
      outboundEdges,
      inDegree,
      startNodeId: startNodeIds[0]!,
      endNodeIds,
    },
  }
}

const DEFAULT_OUTBOUND_HANDLE = 'out'

export const getExecutionGraphSuccessors = (
  graph: ExecutionGraph,
  nodeId: string,
  branchHandleId?: string,
): string[] => {
  const edges = graph.outboundEdges.get(nodeId) ?? []

  if (!branchHandleId) {
    const defaultEdges = edges.filter((edge) => !edge.sourceHandle || edge.sourceHandle === DEFAULT_OUTBOUND_HANDLE)
    const selected = defaultEdges.length > 0 ? defaultEdges : edges
    return selected.map((edge) => edge.target)
  }

  return edges
    .filter((edge) => edge.sourceHandle === branchHandleId)
    .map((edge) => edge.target)
}
