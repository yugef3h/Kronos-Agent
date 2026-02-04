import { buildExecutionGraph, getExecutionGraphSuccessors } from './buildExecutionGraph.js'
import type { ExecutionGraph, ExecutionGraphNode } from './buildExecutionGraph.js'
import {
  NodeExecutorNotFoundError,
  executeWorkflowNode,
  nodeExecutorRegistry,
} from './nodeExecutors.js'
import type { WorkflowNodeBlockKind, WorkflowNodePayload } from './nodeExecutors.js'
import { RunContext } from './runContext.js'
import { transitionWorkflowRun } from './workflowFsm.js'
import { toWorkflowRunSummary } from './workflowRunSummary.js'
import { WorkflowRunStatus, NodeRunStatus, type RunError, type WorkflowRunSummary } from './types.js'
import { workflowRunStore } from './workflowRunStore.js'
import type { WorkflowDraftDslGraph, WorkflowDraftDslNode } from './workflowDsl.js'
import { extractWorkflowDraftDslGraph } from './workflowDsl.js'
import { appendWorkflowRunEvent } from './workflowRunEvents.js'
import { isWorkflowRunCancelled, clearWorkflowRunCancellation } from './workflowRunCancellation.js'

const DEFAULT_MAX_STEPS = 128
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

export type WorkflowDraftNodeRunRecord = {
  nodeId: string
  nodeType: string
  status: NodeRunStatus
  startedAt: number
  finishedAt: number
  elapsedMs: number
  iterationIndex?: number
  outputs?: Record<string, unknown>
  error?: RunError
}

export type RunWorkflowDraftInput = {
  appId: string
  dsl: unknown
  inputs?: Record<string, unknown>
  maxSteps?: number
  timeoutMs?: number
}

export type RunWorkflowDraftResult = {
  run: WorkflowRunSummary
  nodeRuns: WorkflowDraftNodeRunRecord[]
}

export type RunWorkflowDraftIssue = {
  code: 'invalid_dsl' | 'graph_build_failed' | 'executor_not_found'
  message: string
  details?: unknown
}

export type RunWorkflowDraftResponse =
  | { ok: true; result: RunWorkflowDraftResult }
  | { ok: false; issues: RunWorkflowDraftIssue[] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isExecutableBlockKind = (type: ExecutionGraphNode['type']): type is WorkflowNodeBlockKind =>
  nodeExecutorRegistry.has(type as WorkflowNodeBlockKind)

const toWorkflowNodePayload = (
  graphNode: ExecutionGraphNode,
  dslNode: WorkflowDraftDslNode | undefined,
  runtimeInputs?: Record<string, unknown>,
): WorkflowNodePayload => {
  const data = isRecord(dslNode?.data) ? dslNode.data : undefined

  return {
    id: graphNode.id,
    type: graphNode.type as WorkflowNodeBlockKind,
    ...(data ? { data, inputs: data } : {}),
    ...(graphNode.type === 'start' && runtimeInputs ? { inputs: runtimeInputs } : {}),
  }
}

const appendEmbeddedNodeRuns = (
  nodeRuns: WorkflowDraftNodeRunRecord[],
  outputs?: Record<string, unknown>,
): void => {
  const embedded = outputs?.nodeRuns
  if (!Array.isArray(embedded)) {
    return
  }

  for (const item of embedded) {
    if (!isRecord(item) || typeof item.nodeId !== 'string') {
      continue
    }

    nodeRuns.push(item as WorkflowDraftNodeRunRecord)
  }
}

const emitNodeStarted = (runId: string, nodeId: string, iterationIndex?: number): void => {
  appendWorkflowRunEvent({
    type: 'node_started',
    runId,
    timestamp: Date.now(),
    nodeId,
    status: NodeRunStatus.Running,
    ...(iterationIndex !== undefined ? { iterationIndex } : {}),
  })
}

const emitNodeFinished = (
  runId: string,
  record: WorkflowDraftNodeRunRecord,
): void => {
  appendWorkflowRunEvent({
    type: 'node_finished',
    runId,
    timestamp: Date.now(),
    nodeId: record.nodeId,
    status: record.status,
    ...(record.iterationIndex !== undefined ? { iterationIndex: record.iterationIndex } : {}),
    ...(record.error ? { error: record.error } : {}),
  })
}

const emitWorkflowFinished = (
  runId: string,
  status: WorkflowRunStatus,
  error?: RunError,
): void => {
  appendWorkflowRunEvent({
    type: 'workflow_finished',
    runId,
    timestamp: Date.now(),
    status,
    ...(error ? { error } : {}),
  })
}

const toNodeRunRecord = (
  graphNode: ExecutionGraphNode,
  result: Awaited<ReturnType<typeof executeWorkflowNode>>,
): WorkflowDraftNodeRunRecord => ({
  nodeId: result.nodeId,
  nodeType: graphNode.type,
  status: result.status,
  startedAt: result.startedAt,
  finishedAt: result.finishedAt,
  elapsedMs: result.elapsedMs,
  ...(result.outputs ? { outputs: result.outputs } : {}),
  ...(result.error ? { error: result.error } : {}),
})

export const runWorkflowDraftGraph = async (
  input: {
    appId: string
    graph: WorkflowDraftDslGraph
    executionGraph: ExecutionGraph
    inputs?: Record<string, unknown>
    maxSteps?: number
    timeoutMs?: number
  },
): Promise<RunWorkflowDraftResult> => {
  const startedAt = Date.now()
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const runRecord = workflowRunStore.create({
    appId: input.appId,
    kind: 'draft',
    status: WorkflowRunStatus.Running,
  })
  clearWorkflowRunCancellation(runRecord.runId)
  workflowRunStore.update(runRecord.runId, { startedAt, touchTtl: false })

  const shouldCancel = (): boolean => isWorkflowRunCancelled(runRecord.runId)
  const isTimedOut = (): boolean => Date.now() - startedAt > timeoutMs

  const context = new RunContext({
    runId: runRecord.runId,
    appId: input.appId,
    inputs: input.inputs,
    sys: {
      conversation_id: runRecord.runId,
    },
  })

  const nodeRuns: WorkflowDraftNodeRunRecord[] = []
  const maxSteps = input.maxSteps ?? DEFAULT_MAX_STEPS
  const queue = [input.executionGraph.startNodeId]
  const visited = new Set<string>()

  let workflowStatus = WorkflowRunStatus.Running
  let workflowError: RunError | undefined

  while (queue.length > 0 && nodeRuns.length < maxSteps) {
    if (shouldCancel()) {
      workflowStatus = WorkflowRunStatus.Cancelled
      workflowError = {
        code: 'workflow_run_cancelled',
        message: 'Workflow run cancelled',
      }
      break
    }

    if (isTimedOut()) {
      workflowStatus = WorkflowRunStatus.Stopped
      workflowError = {
        code: 'workflow_run_timeout',
        message: 'Workflow run timed out',
      }
      break
    }

    const nodeId = queue.shift()
    if (!nodeId || visited.has(nodeId)) {
      continue
    }

    visited.add(nodeId)

    const graphNode = input.executionGraph.nodes.get(nodeId)
    if (!graphNode) {
      continue
    }

    if (!isExecutableBlockKind(graphNode.type)) {
      continue
    }

    emitNodeStarted(runRecord.runId, nodeId)

    const dslNode = input.graph.nodeById.get(nodeId)
    const payload = toWorkflowNodePayload(graphNode, dslNode, input.inputs)

    let nodeResult: Awaited<ReturnType<typeof executeWorkflowNode>>
    try {
      nodeResult = await executeWorkflowNode({
        runId: runRecord.runId,
        appId: input.appId,
        node: payload,
        context,
        dslGraph: input.graph,
        shouldCancel,
      })
    } catch (error) {
      if (error instanceof NodeExecutorNotFoundError) {
        workflowStatus = WorkflowRunStatus.Failed
        workflowError = {
          code: 'executor_not_found',
          message: error.message,
          nodeId,
        }
        break
      }

      throw error
    }

    const nodeRecord = toNodeRunRecord(graphNode, nodeResult)
    nodeRuns.push(nodeRecord)
    emitNodeFinished(runRecord.runId, nodeRecord)
    appendEmbeddedNodeRuns(nodeRuns, nodeResult.outputs)

    if (nodeResult.status === NodeRunStatus.Failed || nodeResult.status === NodeRunStatus.Exception) {
      workflowStatus = WorkflowRunStatus.Failed
      workflowError = nodeResult.error ?? {
        code: 'node_execution_failed',
        message: `Node ${nodeId} failed`,
        nodeId,
      }
      break
    }

    if (input.executionGraph.endNodeIds.has(nodeId)) {
      workflowStatus = WorkflowRunStatus.Succeeded
      break
    }

    const branchHandleId = graphNode.type === 'if-else' && typeof nodeResult.branchId === 'string'
      ? nodeResult.branchId
      : undefined

    const successors = getExecutionGraphSuccessors(input.executionGraph, nodeId, branchHandleId)
    for (const successorId of successors) {
      if (!visited.has(successorId)) {
        queue.push(successorId)
      }
    }
  }

  if (workflowStatus === WorkflowRunStatus.Running) {
    workflowStatus = nodeRuns.length > 0
      ? WorkflowRunStatus.Succeeded
      : WorkflowRunStatus.Failed
  }

  const finishedAt = Date.now()

  const updated = workflowRunStore.update(runRecord.runId, {
    status: workflowStatus,
    startedAt,
    finishedAt,
    ...(workflowError ? { error: workflowError } : { error: null }),
  }) ?? runRecord

  transitionWorkflowRun(WorkflowRunStatus.Running, workflowStatus)
  emitWorkflowFinished(runRecord.runId, workflowStatus, workflowError)
  clearWorkflowRunCancellation(runRecord.runId)

  return {
    run: toWorkflowRunSummary({
      ...updated,
      startedAt,
      finishedAt,
      status: workflowStatus,
      ...(workflowError ? { error: workflowError } : {}),
    }),
    nodeRuns,
  }
}

export const runWorkflowDraft = async (
  input: RunWorkflowDraftInput,
): Promise<RunWorkflowDraftResponse> => {
  const graph = extractWorkflowDraftDslGraph(input.dsl)
  if (!graph) {
    return {
      ok: false,
      issues: [{ code: 'invalid_dsl', message: 'Invalid workflow DSL payload' }],
    }
  }

  const built = buildExecutionGraph(graph)
  if (built.ok === false) {
    return {
      ok: false,
      issues: built.issues.map((issue) => ({
        code: 'graph_build_failed',
        message: issue.message,
        details: issue,
      })),
    }
  }

  try {
    const result = await runWorkflowDraftGraph({
      appId: input.appId,
      graph,
      executionGraph: built.graph,
      inputs: input.inputs,
      maxSteps: input.maxSteps,
      timeoutMs: input.timeoutMs,
    })

    return { ok: true, result }
  } catch (error) {
    if (error instanceof NodeExecutorNotFoundError) {
      return {
        ok: false,
        issues: [{
          code: 'executor_not_found',
          message: error.message,
          details: { kind: error.kind },
        }],
      }
    }

    throw error
  }
}
