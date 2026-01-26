/**
 * Workflow draft-run & node-debug shared types (server).
 * String values align with `apps/web/.../types/common.ts` where noted.
 */

/** Global workflow run FSM — extends web `WorkflowRunningStatus` with queue/retry/cancel. */
export enum WorkflowRunStatus {
  Queued = 'queued',
  /** Same value as web `WorkflowRunningStatus.Waiting` */
  Waiting = 'waiting',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Retry = 'retry',
  /** Same value as web `WorkflowRunningStatus.Stopped` */
  Stopped = 'stopped',
  Cancelled = 'cancelled',
  Paused = 'paused',
}

/** Per-node execution FSM — mirrors web `NodeRunningStatus`. */
export enum NodeRunStatus {
  NotStart = 'not-start',
  Waiting = 'waiting',
  Listening = 'listening',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Exception = 'exception',
  Retry = 'retry',
  Stopped = 'stopped',
  Paused = 'paused',
}

export type RunError = {
  code: string
  message: string
  nodeId?: string
  details?: unknown
}

// 工作流运行记录
export type WorkflowRunRecord = {
  runId: string
  appId: string
  status: WorkflowRunStatus
  createdAt: number
  updatedAt: number
  expiresAt: number
  startedAt?: number
  finishedAt?: number
  error?: RunError
}

// 创建工作流运行记录
export type CreateWorkflowRunInput = {
  appId: string
  ttlMs?: number
  status?: WorkflowRunStatus
}

export type UpdateWorkflowRunPatch = {
  status?: WorkflowRunStatus
  startedAt?: number
  finishedAt?: number
  error?: RunError | null
  touchTtl?: boolean
  ttlMs?: number
}

export const TERMINAL_WORKFLOW_RUN_STATUSES: ReadonlySet<WorkflowRunStatus> = new Set([
  WorkflowRunStatus.Succeeded,
  WorkflowRunStatus.Failed,
  WorkflowRunStatus.Stopped,
  WorkflowRunStatus.Cancelled,
])

export const TERMINAL_NODE_RUN_STATUSES: ReadonlySet<NodeRunStatus> = new Set([
  NodeRunStatus.Succeeded,
  NodeRunStatus.Failed,
  NodeRunStatus.Exception,
  NodeRunStatus.Stopped,
])

export const isTerminalWorkflowRunStatus = (status: WorkflowRunStatus): boolean =>
  TERMINAL_WORKFLOW_RUN_STATUSES.has(status)

export const isTerminalNodeRunStatus = (status: NodeRunStatus): boolean =>
  TERMINAL_NODE_RUN_STATUSES.has(status)
