import type { WorkflowRunCancellationBackend } from './workflowRunCancellationBackend.js'

const cancelledRunIds = new Set<string>()

export class MemoryWorkflowRunCancellation implements WorkflowRunCancellationBackend {
  async markCancelled(runId: string): Promise<void> {
    cancelledRunIds.add(runId)
  }

  async isCancelled(runId: string): Promise<boolean> {
    return cancelledRunIds.has(runId)
  }

  async clear(runId: string): Promise<void> {
    cancelledRunIds.delete(runId)
  }
}
