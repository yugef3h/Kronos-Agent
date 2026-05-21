import { Queue, Worker } from 'bullmq';
import { runChatAiTask } from './runChatAiTask.js';
import { getRedisClient } from '../../infra/redisClient.js';
import type { AiTaskRecord } from '../types/aiTaskRecord.js';
import { buildAiTaskJobId } from './buildAiTaskJobId.js';
import { getAiTaskStore } from './getAiTaskStore.js';

export const AI_TASK_QUEUE_NAME = 'kronos-ai-tasks';

let queue: Queue<AiTaskRecord> | undefined;
let worker: Worker<AiTaskRecord> | undefined;

export const isAiTaskQueueEnabled = (): boolean =>
  (process.env.AI_TASK_QUEUE_ENABLED ?? 'false').trim().toLowerCase() === 'true';

const queueConnection = () => getRedisClient().duplicate();

export const getAiTaskQueue = (): Queue<AiTaskRecord> => {
  if (!queue) {
    queue = new Queue<AiTaskRecord>(AI_TASK_QUEUE_NAME, {
      connection: queueConnection(),
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    });
  }

  return queue;
};

/** Q-09: 入队异步 AI 任务（需 Redis + AI_TASK_QUEUE_ENABLED） */
export const enqueueAiTask = async (record: AiTaskRecord): Promise<void> => {
  const jobId = buildAiTaskJobId(record.kind, record.taskId);
  await getAiTaskQueue().add(record.kind, record, {
    jobId,
    priority: record.priority,
  });
  await getAiTaskStore().patch(record.taskId, { status: 'queued', progress: 0 });
};

/** P2-Q-03: BullMQ Worker 消费 chat 任务 */
export const startAiTaskWorker = (): Worker<AiTaskRecord> => {
  if (worker) {
    return worker;
  }

  worker = new Worker<AiTaskRecord>(
    AI_TASK_QUEUE_NAME,
    async (job) => {
      if (job.data.kind === 'chat') {
        await runChatAiTask(job.data.taskId);
      }
    },
    { connection: queueConnection() },
  );

  worker.on('failed', (job, error) => {
    console.warn(`[ai:queue] job failed taskId=${job?.data.taskId ?? 'unknown'}:`, error);
  });

  return worker;
};
