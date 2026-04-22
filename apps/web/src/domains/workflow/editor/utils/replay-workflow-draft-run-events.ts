import {
  subscribeWorkflowDraftRunEvents,
  type WorkflowDraftNodeRunRecord,
  type WorkflowRunEvent,
} from '../../app/workflowRunApi'

export const sleepAnimationFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })

export const shouldStaggerWorkflowRunEvent = (event: WorkflowRunEvent): boolean =>
  event.type === 'node_started' || event.type === 'node_finished'

/** 串行应用事件，节点事件之间隔一帧，便于画布逐步显示运行/打钩。 */
export const applyWorkflowRunEventsWithStagger = async (
  events: WorkflowRunEvent[],
  applyEvent: (event: WorkflowRunEvent) => void,
  signal?: AbortSignal,
): Promise<void> => {
  for (const event of events) {
    if (signal?.aborted) {
      return
    }

    applyEvent(event)

    if (shouldStaggerWorkflowRunEvent(event)) {
      await sleepAnimationFrame()
    }
  }
}

export const buildWorkflowRunEventsFromNodeRuns = (
  runId: string,
  nodeRuns: WorkflowDraftNodeRunRecord[],
): WorkflowRunEvent[] => {
  const sorted = [...nodeRuns].sort(
    (left, right) => left.startedAt - right.startedAt || left.finishedAt - right.finishedAt,
  )

  const events: WorkflowRunEvent[] = []

  for (const record of sorted) {
    events.push({
      type: 'node_started',
      runId,
      timestamp: record.startedAt,
      nodeId: record.nodeId,
    })
    events.push({
      type: 'node_finished',
      runId,
      timestamp: record.finishedAt,
      nodeId: record.nodeId,
      status: record.status,
      ...(record.error ? { error: record.error } : {}),
    })
  }

  return events
}

/** 实时 SSE：事件入队，逐帧应用，避免同批 onmessage 只渲染终态。 */
export const createStaggeredWorkflowRunEventApplicator = (
  applyEvent: (event: WorkflowRunEvent) => void,
): ((event: WorkflowRunEvent) => void) => {
  let chain = Promise.resolve()

  return (event: WorkflowRunEvent) => {
    chain = chain.then(async () => {
      applyEvent(event)
      if (shouldStaggerWorkflowRunEvent(event)) {
        await sleepAnimationFrame()
      }
    })
  }
}

const REPLAY_SSE_TIMEOUT_MS = 4_000

export type ReplayWorkflowDraftRunEventsResult = {
  events: WorkflowRunEvent[]
  hasNodeLifecycleEvents: boolean
}

/** 拉取已落库的 draft-run SSE 并按帧回放（同步 POST 完成后使用）。 */
export const replayWorkflowDraftRunEvents = async (
  appId: string,
  runId: string,
  applyEvent: (event: WorkflowRunEvent) => void,
  signal?: AbortSignal,
): Promise<ReplayWorkflowDraftRunEventsResult> => {
  const events: WorkflowRunEvent[] = []
  let settled = false

  const finish = () => {
    if (settled) {
      return
    }

    settled = true
  }

  const unsubscribe = subscribeWorkflowDraftRunEvents(appId, runId, {
    onEvent: (event) => {
      events.push(event)

      if (event.type === 'workflow_finished') {
        unsubscribe()
        finish()
      }
    },
    onError: () => {
      unsubscribe()
      finish()
    },
  })

  await new Promise<void>((resolve) => {
    const timer = globalThis.setTimeout(() => {
      unsubscribe()
      finish()
      resolve()
    }, REPLAY_SSE_TIMEOUT_MS)

    const waitForSettled = () => {
      if (settled) {
        globalThis.clearTimeout(timer)
        resolve()
        return
      }

      globalThis.requestAnimationFrame(waitForSettled)
    }

    waitForSettled()
  })

  await applyWorkflowRunEventsWithStagger(events, applyEvent, signal)

  return {
    events,
    hasNodeLifecycleEvents: events.some(
      (event) => event.type === 'node_started' || event.type === 'node_finished',
    ),
  }
}
