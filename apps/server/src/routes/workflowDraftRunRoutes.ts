import type { Request, Response } from 'express'
import { Router } from 'express'
import { normalizeWorkflowAppId } from '../services/workflowDraftPreviewDiskStore.js'

export const DRAFT_RUN_NOT_IMPLEMENTED = {
  error: 'Workflow draft run is not implemented yet',
  code: 'draft_run_not_implemented',
} as const

export const normalizeWorkflowRunId = (runId: string): string | null => {
  const normalized = runId.trim()
  return /^run_[a-zA-Z0-9_-]{1,120}$/.test(normalized) ? normalized : null
}

export const respondDraftRunNotImplemented = (response: Response): void => {
  response.status(501).json(DRAFT_RUN_NOT_IMPLEMENTED)
}

const resolveAppId = (request: Request, response: Response): string | null => {
  const appId = normalizeWorkflowAppId(String(request.params.appId || ''))
  if (!appId) {
    response.status(400).json({ error: 'Invalid app id' })
    return null
  }

  return appId
}

const resolveRunId = (request: Request, response: Response): string | null => {
  const runId = normalizeWorkflowRunId(String(request.params.runId || ''))
  if (!runId) {
    response.status(400).json({ error: 'Invalid run id' })
    return null
  }

  return runId
}

export const workflowDraftRunRoutes = Router()

workflowDraftRunRoutes.post('/workflow/apps/:appId/draft-runs', (request, response) => {
  if (!resolveAppId(request, response)) {
    return
  }

  respondDraftRunNotImplemented(response)
})

workflowDraftRunRoutes.get('/workflow/apps/:appId/draft-runs/:runId', (request, response) => {
  if (!resolveAppId(request, response)) {
    return
  }

  if (!resolveRunId(request, response)) {
    return
  }

  respondDraftRunNotImplemented(response)
})

workflowDraftRunRoutes.get('/workflow/apps/:appId/draft-runs/:runId/events', (request, response) => {
  if (!resolveAppId(request, response)) {
    return
  }

  if (!resolveRunId(request, response)) {
    return
  }

  respondDraftRunNotImplemented(response)
})

workflowDraftRunRoutes.post('/workflow/apps/:appId/draft-runs/:runId/cancel', (request, response) => {
  if (!resolveAppId(request, response)) {
    return
  }

  if (!resolveRunId(request, response)) {
    return
  }

  respondDraftRunNotImplemented(response)
})
