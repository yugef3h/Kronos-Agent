import type { Request, Response } from 'express'
import { Router } from 'express'
import { normalizeWorkflowAppId } from '../services/workflow/workflowDraftPreviewDiskStore.js'
import { runWorkflowDraft } from '../services/workflow/runner/workflowDraftRunner.js'
import { workflowRunStore } from '../services/workflow/store/workflowRunStore.js'
import { toWorkflowRunSummary } from '../services/workflow/runner/workflowRunSummary.js'
import {
  formatWorkflowRunEventSse,
  listWorkflowRunEvents,
} from '../services/workflow/store/workflowRunEvents.js'
import { cancelWorkflowRunRecord } from '../services/workflow/store/workflowRunCancellation.js'
import { parseStartWorkflowDraftRunBody } from './workflowDraftRunRequest.js'
import { normalizeWorkflowRunId } from './workflowRunId.js'
import '../workflow/registerNodeExecutors.js'

export { normalizeWorkflowRunId } from './workflowRunId.js'

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
    timeoutMs: parsedBody.data.options?.timeoutMs,
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

export const handleGetWorkflowDraftRunGet = async (
  request: Pick<Request, 'params'>,
  response: Response,
): Promise<void> => {
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

  const record = await workflowRunStore.get(runId)
  if (!record || record.appId !== appId) {
    response.status(404).json({ error: 'Workflow draft run not found' })
    return
  }

  response.json({ run: toWorkflowRunSummary(record) })
}

export const handleWorkflowDraftRunEventsGet = async (
  request: Pick<Request, 'params'>,
  response: Response,
): Promise<void> => {
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

  const record = await workflowRunStore.get(runId)
  if (!record || record.appId !== appId) {
    response.status(404).json({ error: 'Workflow draft run not found' })
    return
  }

  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache')
  response.setHeader('Connection', 'keep-alive')

  for (const event of await listWorkflowRunEvents(runId)) {
    response.write(formatWorkflowRunEventSse(event))
  }

  response.end()
}

export const handleCancelWorkflowDraftRunPost = async (
  request: Pick<Request, 'params'>,
  response: Response,
): Promise<void> => {
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

  const record = await workflowRunStore.get(runId)
  if (!record || record.appId !== appId) {
    response.status(404).json({ error: 'Workflow draft run not found' })
    return
  }

  const updated = (await cancelWorkflowRunRecord(runId)) ?? record
  response.json({ run: toWorkflowRunSummary(updated) })
}

export const workflowDraftRunRoutes = Router()

workflowDraftRunRoutes.post('/workflow/apps/:appId/draft-runs', async (request, response) => {
  await handleStartWorkflowDraftRunPost(request, response)
})

workflowDraftRunRoutes.get('/workflow/apps/:appId/draft-runs/:runId', async (request, response) => {
  if (!resolveAppId(request, response)) {
    return
  }

  if (!resolveRunId(request, response)) {
    return
  }

  await handleGetWorkflowDraftRunGet(request, response)
})

workflowDraftRunRoutes.get('/workflow/apps/:appId/draft-runs/:runId/events', async (request, response) => {
  await handleWorkflowDraftRunEventsGet(request, response)
})

workflowDraftRunRoutes.post('/workflow/apps/:appId/draft-runs/:runId/cancel', async (request, response) => {
  await handleCancelWorkflowDraftRunPost(request, response)
})
