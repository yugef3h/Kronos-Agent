import { WorkflowRunStore } from './memoryWorkflowRunStore.js'

let singleton: WorkflowRunStore | undefined

export const createWorkflowRunStore = (): WorkflowRunStore => new WorkflowRunStore()

export const getWorkflowRunStore = (): WorkflowRunStore => {
  if (!singleton) {
    singleton = createWorkflowRunStore()
  }

  return singleton
}
