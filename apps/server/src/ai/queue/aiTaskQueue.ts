import { Queue } from 'bullmq';
import { getRedisClient } from '../../infra/redisClient.js';
import type { AiTaskRecord } from '../types/aiTaskRecord.js';
import { buildAiTaskJobId } from './buildAiTaskJobId.js';
import { patchAiTask } from './memoryAiTaskStore.js';

export const AI_TASK_QUEUE_NAME = 'kronos-ai-tasks';

let queue: Queue<AiTaskRecord> | undefined;

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
  await patchAiTask(record.taskId, { status: 'queued', progress: 0 });
};
