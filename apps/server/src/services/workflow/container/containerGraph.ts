import type { WorkflowDraftDslGraph, WorkflowDraftDslNode } from '../workflowDsl.js'
import {
  getExecutionGraphSuccessors,
  type ExecutionGraph,
  type ExecutionGraphEdge,
  type ExecutionGraphNode,
  type WorkflowDslGraphNode,
} from '../engine/buildExecutionGraph.js'

export type ContainerKind = 'loop' | 'iteration'

export type ContainerGraphSpec = {
  kind: ContainerKind
  startType: 'loop-start' | 'iteration-start'
  endType: 'loop-end' | 'iteration-end'
}

export const CONTAINER_GRAPH_SPECS: Record<ContainerKind, ContainerGraphSpec> = {
  loop: {
    kind: 'loop',
    startType: 'loop-start',
    endType: 'loop-end',
  },
  iteration: {
    kind: 'iteration',
    startType: 'iteration-start',
    endType: 'iteration-end',
  },
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const resolveSemanticType = (node: WorkflowDslGraphNode | WorkflowDraftDslNode): string | null => {
  if (isRecord(node.data) && typeof node.data.type === 'string') {
    return node.data.type
  }

  const kind = isRecord(node.data) && typeof node.data.kind === 'string'
    ? node.data.kind
    : node.type

  return typeof kind === 'string' ? kind : null
}

export type ContainerExecutionGraph = ExecutionGraph & {
  containerNodeId: string
  entryNodeId: string
  exitNodeIds: Set<string>
}

export type BuildContainerExecutionGraphResult =
  | { ok: true; graph: ContainerExecutionGraph }
  | { ok: false; message: string }

export const buildContainerExecutionGraph = (
  containerNodeId: string,
  dslGraph: WorkflowDraftDslGraph,
  kind: ContainerKind,
): BuildContainerExecutionGraphResult => {
  const spec = CONTAINER_GRAPH_SPECS[kind]
  const childNodes = dslGraph.nodes.filter((node) => node.parentId === containerNodeId)

  if (!childNodes.length) {
    return { ok: false, message: `Container ${containerNodeId} has no child nodes` }
  }

  const childIds = new Set(childNodes.map((node) => node.id))
  const childEdges = dslGraph.edges.filter((edge) => childIds.has(edge.source) && childIds.has(edge.target))

  const nodes = new Map<string, ExecutionGraphNode>()
  const entryNodes: WorkflowDraftDslNode[] = []
  const exitNodes: WorkflowDraftDslNode[] = []

  for (const node of childNodes) {
    const type = resolveSemanticType(node)
    if (!type) {
      continue
    }

    nodes.set(node.id, {
      id: node.id,
      type: type as ExecutionGraphNode['type'],
      parentId: containerNodeId,
    })

    if (type === spec.startType) {
      entryNodes.push(node)
    }

    if (type === spec.endType) {
      exitNodes.push(node)
    }
  }

  if (!entryNodes.length) {
    return { ok: false, message: `${kind} container is missing inner start node` }
  }

  const adjacency = new Map<string, string[]>()
  const reverseAdjacency = new Map<string, string[]>()
  const outboundEdges = new Map<string, ExecutionGraphEdge[]>()
  const inDegree = new Map<string, number>()

  for (const nodeId of [...childIds]) {
    adjacency.set(nodeId, [])
    reverseAdjacency.set(nodeId, [])
    outboundEdges.set(nodeId, [])
    inDegree.set(nodeId, 0)
  }

  for (const edge of childEdges) {
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
      startNodeId: entryNodes[0]!.id,
      endNodeIds: new Set(exitNodes.map((node) => node.id)),
      containerNodeId,
      entryNodeId: entryNodes[0]!.id,
      exitNodeIds: new Set(exitNodes.map((node) => node.id)),
    },
  }
}

export const getContainerEntrySuccessors = (
  graph: ContainerExecutionGraph,
): string[] => getExecutionGraphSuccessors(graph, graph.entryNodeId)
