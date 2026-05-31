import { Queue, Worker } from 'bullmq'
import { getRedisClient } from '../infra/redisClient.js'
import type { WorkflowDraftQueueJobData } from './workflowDraftQueueTypes.js'

export type { WorkflowDraftQueueJobData } from './workflowDraftQueueTypes.js'

export const WORKFLOW_DRAFT_QUEUE_NAME = 'kronos-workflow-draft-runs'

let queue: Queue<WorkflowDraftQueueJobData> | undefined
let worker: Worker<WorkflowDraftQueueJobData> | undefined

export const isWorkflowQueueEnabled = (): boolean =>
  (process.env.WORKFLOW_QUEUE_ENABLED ?? 'false').trim().toLowerCase() === 'true'

const queueConnection = () => getRedisClient().duplicate()

export const getWorkflowDraftQueue = (): Queue<WorkflowDraftQueueJobData> => {
  if (!queue) {
    queue = new Queue(WORKFLOW_DRAFT_QUEUE_NAME, {
      connection: queueConnection(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    })
  }

  return queue
}

export const enqueueWorkflowDraftRun = async (
  data: WorkflowDraftQueueJobData,
): Promise<void> => {
  await getWorkflowDraftQueue().add('draft-run', data, { jobId: data.runId })
}

export const startWorkflowDraftWorker = (): Worker<WorkflowDraftQueueJobData> => {
  if (worker) {
    return worker
  }

  worker = new Worker<WorkflowDraftQueueJobData>(
    WORKFLOW_DRAFT_QUEUE_NAME,
    async (job) => {
      const { runWorkflowDraftGraphJob } = await import('./workflowDraftRunner.js')
      await runWorkflowDraftGraphJob(job.data)
    },
    { connection: queueConnection() },
  )

  worker.on('failed', (job, error) => {
    console.warn(`[workflow:queue] job failed runId=${job?.id ?? 'unknown'}:`, error)
  })

  return worker
}
