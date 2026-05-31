import {
  NodeExecutorNotFoundError,
  executeWorkflowNode,
  nodeExecutorRegistry,
} from '../nodeExecutors.js'
import type { WorkflowNodeBlockKind, WorkflowNodePayload } from '../nodeExecutors.js'
import type { RunContext } from '../runContext.js'
import { NodeRunStatus, type RunError } from '../../types/types.js'
import type { WorkflowDraftDslGraph, WorkflowDraftDslNode } from '../workflowDsl.js'
import type { WorkflowDraftNodeRunRecord } from '../workflowDraftRunner.js'
import { getExecutionGraphSuccessors } from '../buildExecutionGraph.js'
import type { ExecutionGraphNode } from '../buildExecutionGraph.js'
import {
  getContainerEntrySuccessors,
  type ContainerExecutionGraph,
} from './containerGraph.js'

const CONTAINER_ENTRY_TYPES = new Set(['loop-start', 'iteration-start'])
const CONTAINER_EXIT_TYPES = new Set(['loop-end', 'iteration-end'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isExecutableBlockKind = (type: ExecutionGraphNode['type']): type is WorkflowNodeBlockKind =>
  nodeExecutorRegistry.has(type as WorkflowNodeBlockKind)

const toWorkflowNodePayload = (
  graphNode: ExecutionGraphNode,
  dslNode: WorkflowDraftDslNode | undefined,
): WorkflowNodePayload => {
  const data = isRecord(dslNode?.data) ? dslNode.data : undefined

  return {
    id: graphNode.id,
    type: graphNode.type as WorkflowNodeBlockKind,
    ...(data ? { data, inputs: data } : {}),
  }
}

const toNodeRunRecord = (
  graphNode: ExecutionGraphNode,
  result: Awaited<ReturnType<typeof executeWorkflowNode>>,
  iterationIndex?: number,
): WorkflowDraftNodeRunRecord => ({
  nodeId: result.nodeId,
  nodeType: graphNode.type,
  status: result.status,
  startedAt: result.startedAt,
  finishedAt: result.finishedAt,
  elapsedMs: result.elapsedMs,
  ...(iterationIndex !== undefined ? { iterationIndex } : {}),
  ...(result.outputs ? { outputs: result.outputs } : {}),
  ...(result.error ? { error: result.error } : {}),
})

export type RunContainerSubgraphInput = {
  runId: string
  appId: string
  context: RunContext
  dslGraph: WorkflowDraftDslGraph
  containerGraph: ContainerExecutionGraph
  iterationIndex?: number
  maxSteps?: number
  shouldCancel?: () => boolean
}

export type RunContainerSubgraphResult =
  | { ok: true; nodeRuns: WorkflowDraftNodeRunRecord[] }
  | { ok: false; error: RunError; nodeRuns: WorkflowDraftNodeRunRecord[] }

export const runContainerSubgraph = async (
  input: RunContainerSubgraphInput,
): Promise<RunContainerSubgraphResult> => {
  const nodeRuns: WorkflowDraftNodeRunRecord[] = []
  const maxSteps = input.maxSteps ?? 64
  const queue = [...getContainerEntrySuccessors(input.containerGraph)]
  const visited = new Set<string>()

  while (queue.length > 0 && nodeRuns.length < maxSteps) {
    if (input.shouldCancel?.()) {
      return {
        ok: false,
        error: {
          code: 'workflow_run_cancelled',
          message: 'Workflow run cancelled',
        },
        nodeRuns,
      }
    }

    const nodeId = queue.shift()
    if (!nodeId || visited.has(nodeId)) {
      continue
    }

    visited.add(nodeId)

    const graphNode = input.containerGraph.nodes.get(nodeId)
    if (!graphNode) {
      continue
    }

    if (CONTAINER_EXIT_TYPES.has(graphNode.type)) {
      break
    }

    if (CONTAINER_ENTRY_TYPES.has(graphNode.type)) {
      const successors = getExecutionGraphSuccessors(input.containerGraph, nodeId)
      for (const successorId of successors) {
        if (!visited.has(successorId)) {
          queue.push(successorId)
        }
      }

      continue
    }

    if (!isExecutableBlockKind(graphNode.type)) {
      continue
    }

    const dslNode = input.dslGraph.nodeById.get(nodeId)
    const payload = toWorkflowNodePayload(graphNode, dslNode)

    let nodeResult: Awaited<ReturnType<typeof executeWorkflowNode>>
    try {
      nodeResult = await executeWorkflowNode({
        runId: input.runId,
        appId: input.appId,
        node: payload,
        context: input.context,
        dslGraph: input.dslGraph,
      })
    } catch (error) {
      if (error instanceof NodeExecutorNotFoundError) {
        return {
          ok: false,
          error: {
            code: 'executor_not_found',
            message: error.message,
            nodeId,
          },
          nodeRuns,
        }
      }

      throw error
    }

    nodeRuns.push(toNodeRunRecord(graphNode, nodeResult, input.iterationIndex))

    if (nodeResult.status === NodeRunStatus.Failed || nodeResult.status === NodeRunStatus.Exception) {
      return {
        ok: false,
        error: nodeResult.error ?? {
          code: 'node_execution_failed',
          message: `Node ${nodeId} failed`,
          nodeId,
        },
        nodeRuns,
      }
    }

    const branchHandleId = graphNode.type === 'if-else' && typeof nodeResult.branchId === 'string'
      ? nodeResult.branchId
      : undefined

    const successors = getExecutionGraphSuccessors(input.containerGraph, nodeId, branchHandleId)
    for (const successorId of successors) {
      if (!visited.has(successorId)) {
        queue.push(successorId)
      }
    }
  }

  return { ok: true, nodeRuns }
}
