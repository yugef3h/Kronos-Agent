export type TimelineStage = 'plan' | 'tool' | 'reason';

export type TimelineStatus = 'start' | 'end' | 'info';

export type TimelineEvent = {
  type: 'timeline';
  stage: TimelineStage;
  status: TimelineStatus;
  message: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  toolError?: string;
  timestamp: number;
};

export type ContentEvent = {
  type: 'content';
  content: string;
};

export type LangChainStreamEvent = TimelineEvent | ContentEvent;
