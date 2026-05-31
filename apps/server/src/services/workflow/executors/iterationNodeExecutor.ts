import { NodeRunStatus } from '../types/types.js'
import { runIterationSandbox } from '../container/iterationSandbox.js'
import type { NodeExecutor } from './nodeExecutors.js'

export const executeIterationNode: NodeExecutor = async (request) => {
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
        code: 'iteration_missing_dsl_graph',
        message: 'Iteration executor requires workflow DSL graph',
        nodeId: request.node.id,
      },
    }
  }

  const sandbox = await runIterationSandbox({
    runId: request.runId,
    appId: request.appId,
    iterationNodeId: request.node.id,
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
            code: 'iteration_sandbox_failed',
            message: 'Iteration sandbox execution failed',
            nodeId: request.node.id,
          },
        }
      : {}),
  }
}
