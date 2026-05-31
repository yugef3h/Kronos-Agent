import { NodeRunStatus } from '../types/types.js'
import type { RunContext } from '../runner/runContext.js'
import type { WorkflowDraftDslGraph } from '../engine/workflowDsl.js'
import type { WorkflowDraftNodeRunRecord } from '../runner/workflowDraftRunner.js'
import { buildContainerExecutionGraph } from './containerGraph.js'
import { normalizeIterationNodeConfig } from './iterationConfig.js'
import { runContainerSubgraph } from './runContainerSubgraph.js'

const resolveIteratorItems = (
  context: RunContext,
  selector: string[],
): unknown[] => {
  const value = context.resolve(selector)
  return Array.isArray(value) ? value : []
}

const resolveIterationRoundOutput = (
  context: RunContext,
  selector: string[],
): unknown => {
  if (!selector.length) {
    return undefined
  }

  return context.resolve(selector)
}

export type RunIterationSandboxInput = {
  runId: string
  appId: string
  iterationNodeId: string
  configValue: unknown
  context: RunContext
  dslGraph: WorkflowDraftDslGraph
  shouldCancel?: () => boolean
}

export type RunIterationSandboxResult = {
  status: NodeRunStatus
  iterations: number
  nodeRuns: WorkflowDraftNodeRunRecord[]
  outputs: Record<string, unknown>
}

export const runIterationSandbox = async (
  input: RunIterationSandboxInput,
): Promise<RunIterationSandboxResult> => {
  const config = normalizeIterationNodeConfig(input.configValue, input.iterationNodeId)
  const built = buildContainerExecutionGraph(input.iterationNodeId, input.dslGraph, 'iteration')

  if (built.ok === false) {
    return {
      status: NodeRunStatus.Failed,
      iterations: 0,
      nodeRuns: [],
      outputs: { error: built.message },
    }
  }

  const items = resolveIteratorItems(input.context, config.iterator_selector)
  const allNodeRuns: WorkflowDraftNodeRunRecord[] = []
  const roundOutputs: unknown[] = []

  for (let index = 0; index < items.length; index += 1) {
    if (input.shouldCancel?.()) {
      break
    }

    const item = items[index]
    input.context.pushContainer({
      kind: 'iteration',
      nodeId: input.iterationNodeId,
      index,
    })
    input.context.setSys('item', item)
    input.context.setSys('index', index)

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
        iterations: index,
        nodeRuns: allNodeRuns,
        outputs: {
          iterations: index,
          error: round.error,
        },
      }
    }

    const roundOutput = resolveIterationRoundOutput(input.context, config.output_selector)
    roundOutputs.push(roundOutput ?? item)
  }

  return {
    status: NodeRunStatus.Succeeded,
    iterations: roundOutputs.length,
    nodeRuns: allNodeRuns,
    outputs: {
      result: roundOutputs,
      iterations: roundOutputs.length,
    },
  }
}
