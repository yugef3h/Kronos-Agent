import { NodeRunStatus } from '../types/types.js'
import type { RunContext } from '../runner/runContext.js'
import type { WorkflowDraftDslGraph } from '../engine/workflowDsl.js'
import type { WorkflowDraftNodeRunRecord } from '../runner/workflowDraftRunner.js'
import { buildContainerExecutionGraph } from './containerGraph.js'
import { normalizeLoopNodeConfig } from './loopConfig.js'
import { runContainerSubgraph } from './runContainerSubgraph.js'

export type RunLoopSandboxInput = {
  runId: string
  appId: string
  loopNodeId: string
  configValue: unknown
  context: RunContext
  dslGraph: WorkflowDraftDslGraph
  shouldCancel?: () => boolean
}

export type RunLoopSandboxResult = {
  status: NodeRunStatus
  iterations: number
  nodeRuns: WorkflowDraftNodeRunRecord[]
  outputs: Record<string, unknown>
}

export const runLoopSandbox = async (
  input: RunLoopSandboxInput,
): Promise<RunLoopSandboxResult> => {
  const config = normalizeLoopNodeConfig(input.configValue, input.loopNodeId)
  const built = buildContainerExecutionGraph(input.loopNodeId, input.dslGraph, 'loop')

  if (built.ok === false) {
    return {
      status: NodeRunStatus.Failed,
      iterations: 0,
      nodeRuns: [],
      outputs: {
        error: built.message,
      },
    }
  }

  const allNodeRuns: WorkflowDraftNodeRunRecord[] = []
  let completedIterations = 0

  for (let index = 0; index < config.loop_count; index += 1) {
    if (input.shouldCancel?.()) {
      break
    }

    input.context.pushContainer({
      kind: 'loop',
      nodeId: input.loopNodeId,
      index,
    })
    input.context.setSys('loop_index', index)

    const round = await runContainerSubgraph({
      runId: input.runId,
      appId: input.appId,
      context: input.context,
      dslGraph: input.dslGraph,
      containerGraph: built.graph,
      iterationIndex: index,
      shouldCancel: input.shouldCancel,
    })

    input.context.popContainer()
    allNodeRuns.push(...round.nodeRuns)

    if (round.ok === false) {
      return {
        status: NodeRunStatus.Failed,
        iterations: completedIterations,
        nodeRuns: allNodeRuns,
        outputs: {
          iterations: completedIterations,
          error: round.error,
        },
      }
    }

    completedIterations += 1
  }

  return {
    status: NodeRunStatus.Succeeded,
    iterations: completedIterations,
    nodeRuns: allNodeRuns,
    outputs: {
      iterations: completedIterations,
      loop_index: Math.max(0, completedIterations - 1),
    },
  }
}
