import type {
  CreateWorkflowRunInput,
  SaveNodeDebugRunInput,
  UpdateWorkflowRunPatch,
  WorkflowRunRecord,
} from '../types/types.js'

export type WorkflowRunStoreBackend = {
  create: (input: CreateWorkflowRunInput) => Promise<WorkflowRunRecord>
  get: (runId: string) => Promise<WorkflowRunRecord | undefined>
  update: (
    runId: string,
    patch: UpdateWorkflowRunPatch,
  ) => Promise<WorkflowRunRecord | undefined>
  delete: (runId: string) => Promise<boolean>
  listByAppId: (appId: string) => Promise<WorkflowRunRecord[]>
  saveNodeDebugRun: (input: SaveNodeDebugRunInput) => Promise<WorkflowRunRecord>
  pruneExpired: (now?: number) => Promise<number>
  clear: () => Promise<void>
  size: () => Promise<number>
}
