import type { Request, Response } from 'express'
import { Router } from 'express'
import { normalizeWorkflowAppId } from '../services/workflowDraftPreviewDiskStore.js'
import { runWorkflowDraft } from '../workflow/workflowDraftRunner.js'
import { workflowRunStore } from '../workflow/workflowRunStore.js'
import { toWorkflowRunSummary } from '../workflow/workflowRunSummary.js'
import { parseStartWorkflowDraftRunBody } from './workflowDraftRunRequest.js'
import '../workflow/registerNodeExecutors.js'

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

export const handleStartWorkflowDraftRunPost = async (
  request: Pick<Request, 'params' | 'body'>,
  response: Response,
): Promise<void> => {
  const appId = normalizeWorkflowAppId(String(request.params.appId || ''))
  if (!appId) {
    response.status(400).json({ error: 'Invalid app id' })
    return
  }

  const parsedBody = parseStartWorkflowDraftRunBody(request.body)
  if (!parsedBody.success) {
    response.status(400).json({
      error: 'Invalid draft run request body',
      code: 'draft_run_request_invalid',
    })
    return
  }

  const executed = await runWorkflowDraft({
    appId,
    dsl: parsedBody.data.dsl,
    inputs: parsedBody.data.inputs,
    maxSteps: parsedBody.data.options?.maxSteps,
  })

  if (executed.ok === false) {
    response.status(400).json({
      error: executed.issues[0]?.message ?? 'Failed to start workflow draft run',
      code: executed.issues[0]?.code ?? 'draft_run_failed',
      issues: executed.issues,
    })
    return
  }

  response.status(201).json({
    run: executed.result.run,
    nodeRuns: executed.result.nodeRuns,
  })
}

export const handleGetWorkflowDraftRunGet = (
  request: Pick<Request, 'params'>,
  response: Response,
): void => {
  const appId = normalizeWorkflowAppId(String(request.params.appId || ''))
  const runId = normalizeWorkflowRunId(String(request.params.runId || ''))

  if (!appId) {
    response.status(400).json({ error: 'Invalid app id' })
    return
  }

  if (!runId) {
    response.status(400).json({ error: 'Invalid run id' })
    return
  }

  const record = workflowRunStore.get(runId)
  if (!record || record.appId !== appId) {
    response.status(404).json({ error: 'Workflow draft run not found' })
    return
  }

  response.json({ run: toWorkflowRunSummary(record) })
}

export const workflowDraftRunRoutes = Router()

workflowDraftRunRoutes.post('/workflow/apps/:appId/draft-runs', async (request, response) => {
  await handleStartWorkflowDraftRunPost(request, response)
})

workflowDraftRunRoutes.get('/workflow/apps/:appId/draft-runs/:runId', (request, response) => {
  if (!resolveAppId(request, response)) {
    return
  }

  if (!resolveRunId(request, response)) {
    return
  }

  handleGetWorkflowDraftRunGet(request, response)
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
