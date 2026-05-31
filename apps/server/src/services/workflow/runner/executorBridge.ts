import type { NodeDebugRequest, NodeDebugResult } from '../types/types.js'
import type { RunContext } from '../runner/runContext.js'
import type { NodeExecutionRequest, NodeExecutionResult } from '../executors/nodeExecutors.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const buildDebugVariablesFromRunContext = (
  context: RunContext,
): Record<string, unknown> => {
  const snapshot = context.snapshot()
  const variables: Record<string, unknown> = {
    ...snapshot.sys,
    'sys.conversation_id': snapshot.sys.conversation_id ?? context.runId,
    'sys.query': snapshot.sys.query ?? '',
    'sys.files': snapshot.sys.files ?? [],
  }

  for (const [nodeId, outputs] of Object.entries(snapshot.nodeOutputs)) {
    variables[nodeId] = outputs

    for (const [key, value] of Object.entries(outputs)) {
      variables[`${nodeId}.${key}`] = value
    }
  }

  return variables
}

export const toNodeDebugRequest = (
  request: NodeExecutionRequest,
  runtimeInputs?: Record<string, unknown>,
): NodeDebugRequest => ({
  appId: request.appId,
  node: {
    id: request.node.id,
    type: request.node.type,
    ...(request.node.inputs ? { inputs: request.node.inputs } : {}),
    ...(request.node.data ? { data: request.node.data } : {}),
  },
  ...(runtimeInputs ? { inputs: runtimeInputs } : {}),
  context: {
    variables: buildDebugVariablesFromRunContext(request.context),
  },
})

export const fromNodeDebugResult = (result: NodeDebugResult): NodeExecutionResult => {
  const branchId = isRecord(result.outputs) && typeof result.outputs.branchId === 'string'
    ? result.outputs.branchId
    : undefined

  return {
    nodeId: result.nodeId,
    status: result.status,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    elapsedMs: result.elapsedMs,
    ...(result.inputs ? { inputs: result.inputs } : {}),
    ...(result.outputs ? { outputs: result.outputs } : {}),
    ...(result.error ? { error: result.error } : {}),
    ...(branchId ? { branchId } : {}),
  }
}

export const applyNodeExecutionToRunContext = (
  context: RunContext,
  result: NodeExecutionResult,
): void => {
  if (!result.outputs) {
    return
  }

  context.setNodeOutputs(result.nodeId, result.outputs)

  for (const [key, value] of Object.entries(result.outputs)) {
    if (key.startsWith('sys.')) {
      context.setSys(key.slice(4), value)
    }
  }
}
