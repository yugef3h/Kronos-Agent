import type { Node } from 'reactflow'
import type {
  WorkflowDraftNodeRunRecord,
  WorkflowRunEvent,
} from '../../app/workflowRunApi'
import type { CanvasNodeData } from '../types/canvas'
import type { CommonEdgeType, Edge } from '../types/common'
import { NodeRunningStatus } from '../types/common'
import { toNodeLastRunSnapshotFromDraftRun } from './to-node-last-run-snapshot'

const mapEventNodeStatus = (status?: string): NodeRunningStatus => {
  if (!status) {
    return NodeRunningStatus.Succeeded
  }

  return status as NodeRunningStatus
}

export const setNodeRunStatusOnNodes = (
  nodes: Array<Node<CanvasNodeData>>,
  nodeId: string,
  status: NodeRunningStatus | undefined,
): Array<Node<CanvasNodeData>> => {
  let changed = false

  const nextNodes = nodes.map((node) => {
    if (node.id !== nodeId) {
      return node
    }

    if (node.data._runStatus === status) {
      return node
    }

    changed = true

    if (status === undefined) {
      const { _runStatus, ...rest } = node.data
      void _runStatus
      return {
        ...node,
        data: rest as CanvasNodeData,
      }
    }

    return {
      ...node,
      data: {
        ...node.data,
        _runStatus: status,
      },
    }
  })

  return changed ? nextNodes : nodes
}

export const syncEdgesRunningStatus = (
  edges: Edge[],
  nodes: Array<Node<CanvasNodeData>>,
): Edge[] => {
  const statusById = new Map(
    nodes.map((node) => [node.id, node.data._runStatus] as const),
  )

  let changed = false

  const nextEdges = edges.map((edge) => {
    const sourceStatus = statusById.get(edge.source)
    const targetStatus = statusById.get(edge.target)
    const waitingRun = sourceStatus === undefined

    if (
      edge.data?._sourceRunningStatus === sourceStatus
      && edge.data?._targetRunningStatus === targetStatus
      && edge.data?._waitingRun === waitingRun
    ) {
      return edge
    }

    changed = true

    return {
      ...edge,
      data: {
        ...(edge.data ?? {}),
        _sourceRunningStatus: sourceStatus,
        _targetRunningStatus: targetStatus,
        _waitingRun: waitingRun,
      } as CommonEdgeType,
    }
  })

  return changed ? nextEdges : edges
}

export const clearWorkflowRunCanvasState = (
  nodes: Array<Node<CanvasNodeData>>,
  edges: Edge[],
): { nodes: Array<Node<CanvasNodeData>>; edges: Edge[] } => {
  let nodesChanged = false
  let edgesChanged = false

  const nextNodes = nodes.map((node) => {
    if (node.data._runStatus === undefined) {
      return node
    }

    nodesChanged = true
    const { _runStatus, ...rest } = node.data
    void _runStatus
    return {
      ...node,
      data: rest as CanvasNodeData,
    }
  })

  const nextEdges = edges.map((edge) => {
    if (
      edge.data?._sourceRunningStatus === undefined
      && edge.data?._targetRunningStatus === undefined
      && edge.data?._waitingRun === true
    ) {
      return edge
    }

    edgesChanged = true

    return {
      ...edge,
      data: {
        ...(edge.data ?? {}),
        _sourceRunningStatus: undefined,
        _targetRunningStatus: undefined,
        _waitingRun: true,
      } as CommonEdgeType,
    }
  })

  return {
    nodes: nodesChanged ? nextNodes : nodes,
    edges: edgesChanged ? nextEdges : edges,
  }
}

export const applyWorkflowRunEventToCanvas = (
  nodes: Array<Node<CanvasNodeData>>,
  edges: Edge[],
  event: WorkflowRunEvent,
): { nodes: Array<Node<CanvasNodeData>>; edges: Edge[] } => {
  let nextNodes = nodes

  if (event.type === 'node_started' && event.nodeId) {
    nextNodes = setNodeRunStatusOnNodes(nextNodes, event.nodeId, NodeRunningStatus.Running)
  } else if (event.type === 'node_finished' && event.nodeId) {
    nextNodes = setNodeRunStatusOnNodes(
      nextNodes,
      event.nodeId,
      mapEventNodeStatus(event.status),
    )
  }

  const nextEdges = syncEdgesRunningStatus(edges, nextNodes)

  return { nodes: nextNodes, edges: nextEdges }
}

export const applyWorkflowDraftNodeRunsToCanvas = (
  nodes: Array<Node<CanvasNodeData>>,
  edges: Edge[],
  nodeRuns: WorkflowDraftNodeRunRecord[],
): { nodes: Array<Node<CanvasNodeData>>; edges: Edge[] } => {
  let nextNodes = nodes

  for (const record of nodeRuns) {
    nextNodes = setNodeRunStatusOnNodes(nextNodes, record.nodeId, record.status as NodeRunningStatus)
  }

  return {
    nodes: nextNodes,
    edges: syncEdgesRunningStatus(edges, nextNodes),
  }
}

export const applyNodeLastRunsFromDraftRun = (
  nodes: Array<Node<CanvasNodeData>>,
  runId: string,
  nodeRuns: WorkflowDraftNodeRunRecord[],
): Array<Node<CanvasNodeData>> => {
  const latestByNodeId = new Map<string, WorkflowDraftNodeRunRecord>()

  for (const record of nodeRuns) {
    latestByNodeId.set(record.nodeId, record)
  }

  if (latestByNodeId.size === 0) {
    return nodes
  }

  let changed = false

  const nextNodes = nodes.map((node) => {
    const record = latestByNodeId.get(node.id)
    if (!record) {
      return node
    }

    const lastRun = toNodeLastRunSnapshotFromDraftRun(runId, record)
    changed = true

    return {
      ...node,
      data: {
        ...node.data,
        _lastRun: lastRun,
      },
    }
  })

  return changed ? nextNodes : nodes
}
