import { apiUrl } from '../../../lib/api'
import type { WorkflowDSL } from './workflowAppStore'
import type {
  NodeRunStatus,
  RunError,
  WorkflowRunStatus,
  WorkflowRunSummary,
} from '../editor/types/run'

export type WorkflowRunEventType =
  | 'node_started'
  | 'node_finished'
  | 'workflow_finished'

export type WorkflowRunEvent = {
  type: WorkflowRunEventType
  runId: string
  timestamp: number
  nodeId?: string
  status?: NodeRunStatus
  error?: RunError
}

export type StartWorkflowDraftRunInput = {
  dsl: WorkflowDSL
  inputs?: Record<string, unknown>
  options?: {
    timeoutMs?: number
    maxSteps?: number
  }
}

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

export type StartWorkflowDraftRunResponse = {
  run: WorkflowRunSummary
  nodeRuns: WorkflowDraftNodeRunRecord[]
}

export type GetWorkflowDraftRunResponse = {
  run: WorkflowRunSummary
}

export type CancelWorkflowDraftRunResponse = {
  run: WorkflowRunSummary
}

export class WorkflowRunApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'WorkflowRunApiError'
    this.status = status
    this.code = code
  }
}

type WorkflowRunApiErrorPayload = {
  error?: string
  code?: string
  message?: string
}

export const buildWorkflowDraftRunBasePath = (appId: string): string =>
  `/api/workflow/apps/${encodeURIComponent(appId)}/draft-runs`

export const buildWorkflowDraftRunPath = (appId: string, runId: string, suffix = ''): string => {
  const base = `${buildWorkflowDraftRunBasePath(appId)}/${encodeURIComponent(runId)}`
  return suffix ? `${base}${suffix}` : base
}

export const getWorkflowDraftRunEventsUrl = (appId: string, runId: string): string =>
  apiUrl(buildWorkflowDraftRunPath(appId, runId, '/events'))

const readErrorPayload = async (response: Response): Promise<WorkflowRunApiErrorPayload> => {
  try {
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return {}
    }

    return await response.json() as WorkflowRunApiErrorPayload
  } catch {
    return {}
  }
}

export const parseWorkflowRunApiError = async (
  response: Response,
  fallback: string,
): Promise<WorkflowRunApiError> => {
  const payload = await readErrorPayload(response)
  const message = payload.error?.trim()
    || payload.message?.trim()
    || fallback

  return new WorkflowRunApiError(message, response.status, payload.code)
}

const requestJson = async <T>(
  path: string,
  init: {
    method: string
    headers?: Record<string, string>
    body?: string
  },
  fallback: string,
): Promise<T> => {
  const response = await fetch(apiUrl(path), init)

  if (!response.ok) {
    throw await parseWorkflowRunApiError(response, fallback)
  }

  return await response.json() as T
}

export const startWorkflowDraftRun = async (
  appId: string,
  input: StartWorkflowDraftRunInput,
): Promise<StartWorkflowDraftRunResponse> => {
  return requestJson<StartWorkflowDraftRunResponse>(
    buildWorkflowDraftRunBasePath(appId),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    `Failed to start workflow draft run (${appId})`,
  )
}

export const getWorkflowDraftRun = async (
  appId: string,
  runId: string,
): Promise<GetWorkflowDraftRunResponse> => {
  return requestJson<GetWorkflowDraftRunResponse>(
    buildWorkflowDraftRunPath(appId, runId),
    { method: 'GET' },
    `Failed to load workflow draft run (${runId})`,
  )
}

export const cancelWorkflowDraftRun = async (
  appId: string,
  runId: string,
): Promise<CancelWorkflowDraftRunResponse> => {
  return requestJson<CancelWorkflowDraftRunResponse>(
    buildWorkflowDraftRunPath(appId, runId, '/cancel'),
    { method: 'POST' },
    `Failed to cancel workflow draft run (${runId})`,
  )
}

export type SubscribeWorkflowDraftRunEventsHandlers = {
  onEvent?: (event: WorkflowRunEvent) => void
  onError?: (error: Error) => void
}

/** Subscribe to draft-run SSE replay (`GET …/draft-runs/:runId/events`). */
export const subscribeWorkflowDraftRunEvents = (
  appId: string,
  runId: string,
  handlers: SubscribeWorkflowDraftRunEventsHandlers,
): (() => void) => {
  const source = new EventSource(getWorkflowDraftRunEventsUrl(appId, runId))

  source.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as WorkflowRunEvent
      handlers.onEvent?.(event)
    } catch (error) {
      handlers.onError?.(error instanceof Error ? error : new Error('Invalid workflow run event payload'))
    }
  }

  source.onerror = () => {
    handlers.onError?.(new WorkflowRunApiError('Workflow run event stream failed', 0))
    source.close()
  }

  return () => {
    source.close()
  }
}

export type { WorkflowRunStatus }
