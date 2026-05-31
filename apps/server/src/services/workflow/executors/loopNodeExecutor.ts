import { NodeRunStatus } from '../../types/types.js'
import { runLoopSandbox } from '../container/loopSandbox.js'
import type { NodeExecutor } from '../nodeExecutors.js'

export const executeLoopNode: NodeExecutor = async (request) => {
  const startedAt = Date.now()

  if (!request.dslGraph) {
    const finishedAt = Date.now()
    return {
      nodeId: request.node.id,
      status: NodeRunStatus.Failed,
      startedAt,
      finishedAt,
      elapsedMs: Math.max(0, finishedAt - startedAt),
      error: {
        code: 'loop_missing_dsl_graph',
        message: 'Loop executor requires workflow DSL graph',
        nodeId: request.node.id,
      },
    }
  }

  const sandbox = await runLoopSandbox({
    runId: request.runId,
    appId: request.appId,
    loopNodeId: request.node.id,
    configValue: request.node.data ?? request.node.inputs,
    context: request.context,
    dslGraph: request.dslGraph,
    shouldCancel: request.shouldCancel,
  })

  const finishedAt = Date.now()

  return {
    nodeId: request.node.id,
    status: sandbox.status,
    startedAt,
    finishedAt,
    elapsedMs: Math.max(0, finishedAt - startedAt),
    outputs: {
      ...sandbox.outputs,
      nodeRuns: sandbox.nodeRuns,
    },
    ...(sandbox.status === NodeRunStatus.Failed
      ? {
          error: {
            code: 'loop_sandbox_failed',
            message: 'Loop sandbox execution failed',
            nodeId: request.node.id,
          },
        }
      : {}),
  }
}
