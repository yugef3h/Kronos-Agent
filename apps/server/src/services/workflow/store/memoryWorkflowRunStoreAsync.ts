import type { WorkflowRunStore } from './memoryWorkflowRunStore.js'
import type { WorkflowRunStoreBackend } from './workflowRunStoreBackend.js'

export const toAsyncWorkflowRunStore = (store: WorkflowRunStore): WorkflowRunStoreBackend => ({
  create: async (input) => store.create(input),
  get: async (runId) => store.get(runId),
  update: async (runId, patch) => store.update(runId, patch),
  delete: async (runId) => store.delete(runId),
  listByAppId: async (appId) => store.listByAppId(appId),
  saveNodeDebugRun: async (input) => store.saveNodeDebugRun(input),
  pruneExpired: async (now) => store.pruneExpired(now),
  clear: async () => store.clear(),
  size: async () => store.size(),
})
