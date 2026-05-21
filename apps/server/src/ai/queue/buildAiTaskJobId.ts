import type { AiTaskKind } from '../types/aiTaskKind.js';

const JOB_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;

/** Q-06: BullMQ jobId 规范化 */
export const buildAiTaskJobId = (kind: AiTaskKind, id: string): string => {
  const raw = `${kind}:${id}`.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 128);
  if (!JOB_ID_PATTERN.test(raw)) {
    throw new Error('Invalid AI task job id');
  }

  return raw;
};
