export type WorkflowRunCancellationBackend = {
  markCancelled: (runId: string) => Promise<void>
  isCancelled: (runId: string) => Promise<boolean>
  clear: (runId: string) => Promise<void>
}
