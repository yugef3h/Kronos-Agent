export type StreamChunk = {
  type: 'content' | 'complete';
  content?: string;
  sessionId: string;
  eventId: number;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};
