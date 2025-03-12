export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Session = {
  lastId: number;
  messages: Message[];
};

const sessions = new Map<string, Session>();

export const getSession = (sessionId: string): Session => {
  const existing = sessions.get(sessionId);
  if (existing) return existing;

  const created: Session = { lastId: 0, messages: [] };
  sessions.set(sessionId, created);
  return created;
};

export const listMessages = (sessionId: string): Message[] => getSession(sessionId).messages;
