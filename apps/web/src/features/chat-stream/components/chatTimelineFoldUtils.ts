import type { TimelineEvent } from '../../../types/chat';
import type { TimelineStageLabelMap } from '../types';

export const summarizeTimelineHeader = (
  events: TimelineEvent[],
  current: TimelineEvent | undefined,
  stageLabelMap: TimelineStageLabelMap,
  isActive: boolean,
): string => {
  if (!current) {
    return isActive ? 'Agent 处理中…' : '执行轨迹';
  }

  const stageLabel = stageLabelMap[current.stage];
  const message = current.message.trim();

  if (message.length > 0) {
    return `${stageLabel} · ${message}`;
  }

  if (events.length > 1) {
    return `${stageLabel}（共 ${events.length} 步）`;
  }

  return stageLabel;
};
