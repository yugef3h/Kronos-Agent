import type { WorkflowDslGraph, WorkflowDslGraphEdge, WorkflowDslGraphNode } from '../engine/buildExecutionGraph.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export type WorkflowDraftDslNode = WorkflowDslGraphNode & {
  data?: Record<string, unknown>
}

export type WorkflowDraftDslGraph = WorkflowDslGraph & {
  nodeById: Map<string, WorkflowDraftDslNode>
}

export const extractWorkflowDraftDslGraph = (dsl: unknown): WorkflowDraftDslGraph | null => {
  if (!isRecord(dsl) || !isRecord(dsl.workflow) || !isRecord(dsl.workflow.graph)) {
    return null
  }

  const graph = dsl.workflow.graph
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return null
  }

  const nodes = graph.nodes.filter((node): node is WorkflowDraftDslNode => isRecord(node) && typeof node.id === 'string')
  const edges = graph.edges.filter((edge): edge is WorkflowDslGraphEdge => isRecord(edge)
    && typeof edge.source === 'string'
    && typeof edge.target === 'string')

  const nodeById = new Map<string, WorkflowDraftDslNode>()
  for (const node of nodes) {
    nodeById.set(node.id, node)
  }

  return {
    nodes,
    edges,
    nodeById,
  }
}
