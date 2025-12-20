import type { LangChainStreamEvent, TimelineStage, TimelineStatus } from './streamEventTypes.js';

export const createTimelineEvent = (
  stage: TimelineStage,
  status: TimelineStatus,
  message: string,
  toolName?: string,
  toolInput?: string,
  toolOutput?: string,
  toolError?: string,
): LangChainStreamEvent => ({
  type: 'timeline',
  stage,
  status,
  message,
  toolName,
  toolInput,
  toolOutput,
  toolError,
  timestamp: Date.now(),
});
