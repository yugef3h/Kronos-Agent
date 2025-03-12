export type TimelineEvent = {
  stage: 'plan' | 'tool' | 'reason';
  status: 'start' | 'end' | 'info';
  message: string;
  toolName?: string;
  timestamp: number;
  eventId: number;
};

type ContentChunk = {
  type: 'content';
  content: string;
  sessionId: string;
  eventId: number;
};

type CompleteChunk = {
  type: 'complete';
  sessionId: string;
  eventId: number;
};

type TimelineChunk = {
  type: 'timeline';
  sessionId: string;
  eventId: number;
  stage: TimelineEvent['stage'];
  status: TimelineEvent['status'];
  message: string;
  toolName?: string;
  timestamp: number;
};

export type StreamChunk = ContentChunk | CompleteChunk | TimelineChunk;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};
