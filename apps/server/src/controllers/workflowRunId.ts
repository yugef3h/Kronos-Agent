export const normalizeWorkflowRunId = (runId: string): string | null => {
  const normalized = runId.trim()
  return /^run_[a-zA-Z0-9_-]{1,120}$/.test(normalized) ? normalized : null
}
