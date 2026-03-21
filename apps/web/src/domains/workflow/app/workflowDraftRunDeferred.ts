import {
  WorkflowRunStatus,
  isTerminalWorkflowRunStatus,
  type WorkflowRunSummary,
} from '../editor/types/run'
import type { WorkflowDraftNodeRunRecord } from './workflowRunApi'

/** POST 仅入队（`queued` + 空 nodeRuns）时需轮询 GET + 订阅 events。 */
export const isDeferredWorkflowDraftRun = (
  run: WorkflowRunSummary,
  nodeRuns: WorkflowDraftNodeRunRecord[],
): boolean =>
  run.status === WorkflowRunStatus.Queued
  || (nodeRuns.length === 0 && !isTerminalWorkflowRunStatus(run.status))

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signalReason(signal))
      return
    }

    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      globalThis.clearTimeout(timer)
      reject(signalReason(signal))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })

const signalReason = (signal?: AbortSignal): Error => {
  if (signal?.reason instanceof Error) {
    return signal.reason
  }

  return new DOMException('Aborted', 'AbortError')
}

export const WORKFLOW_DRAFT_RUN_POLL_INTERVAL_MS = 800
export const WORKFLOW_DRAFT_RUN_MAX_WAIT_MS = 5 * 60 * 1000
