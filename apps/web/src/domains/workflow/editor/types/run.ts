import { NodeRunningStatus } from './common'
import type { WorkflowRunningStatus } from './common'

/**
 * Draft-run / node-debug types (web).
 * String values align with `apps/server/src/workflow/types.ts` and `./common.ts`.
 */

/** @deprecated Prefer `WorkflowRunningStatus` on canvas; kept for API payloads with queue/retry/cancel. */
export enum WorkflowRunStatus {
  Queued = 'queued',
  Waiting = 'waiting',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Retry = 'retry',
  Stopped = 'stopped',
  Cancelled = 'cancelled',
  Paused = 'paused',
}

/** Alias for server `NodeRunStatus` — same values as `NodeRunningStatus`. */
export { NodeRunningStatus as NodeRunStatus }

export type RunError = {
  code: string
  message: string
  nodeId?: string
  details?: unknown
}

/** Per-node result of the latest debug or full workflow run. */
export type NodeLastRunSnapshot = {
  runId: string
  nodeId: string
  status: NodeRunningStatus
  startedAt?: number
  finishedAt?: number
  elapsedMs?: number
  /** Set when the node runs inside loop/iteration sandbox. */
  iterationIndex?: number
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  error?: RunError
}

export type WorkflowRunSummary = {
  runId: string
  appId: string
  status: WorkflowRunStatus
  startedAt: number
  finishedAt?: number
  elapsedMs?: number
  error?: RunError
}

export const TERMINAL_WORKFLOW_RUN_STATUSES: ReadonlySet<WorkflowRunStatus> = new Set([
  WorkflowRunStatus.Succeeded,
  WorkflowRunStatus.Failed,
  WorkflowRunStatus.Stopped,
  WorkflowRunStatus.Cancelled,
])

export const TERMINAL_NODE_RUN_STATUSES: ReadonlySet<NodeRunningStatus> = new Set([
  NodeRunningStatus.Succeeded,
  NodeRunningStatus.Failed,
  NodeRunningStatus.Exception,
  NodeRunningStatus.Stopped,
])

export const isTerminalWorkflowRunStatus = (status: WorkflowRunStatus): boolean =>
  TERMINAL_WORKFLOW_RUN_STATUSES.has(status)

export const isTerminalNodeRunStatus = (status: NodeRunningStatus): boolean =>
  TERMINAL_NODE_RUN_STATUSES.has(status)

/** Map canvas `WorkflowRunningStatus` to draft-run API status (subset). */
export const toWorkflowRunStatus = (
  status: WorkflowRunningStatus,
): WorkflowRunStatus => status as unknown as WorkflowRunStatus
