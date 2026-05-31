export type WorkflowDraftQueueJobData = {
  runId: string
  appId: string
  dsl: unknown
  inputs?: Record<string, unknown>
  maxSteps?: number
  timeoutMs?: number
}
