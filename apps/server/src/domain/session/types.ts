export type AttachmentMeta = {
  id: string;
  type: 'image';
  fileName: string;
  mimeType: string;
  size: number;
  filePath?: string;
  storagePath?: string;
  createdAt: number;
};

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  attachments?: AttachmentMeta[];
};

export type SessionAppendMessage = {
  role: Message['role'];
  content: string;
  attachments?: AttachmentMeta[];
};

export type Session = {
  version: number;
  lastId: number;
  messages: Message[];
  memorySummary: string;
  memorySummaryUpdatedAt: number | null;
  summaryArchiveMessageCount?: number;
};

export type PlaygroundHistorySurface = 'default' | 'published';

export type RecentDialogueItem = {
  id: string;
  sessionId: string;
  updatedAt: number;
  userContent: string;
  playgroundSurface: PlaygroundHistorySurface;
  basePlaygroundSessionId: string;
  publishedChatbotWorkflowAppId: string | null;
};
