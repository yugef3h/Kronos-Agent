import type { Session } from './types.js';

export type SaveSessionOptions = {
  expectedVersion?: number;
};

export type SessionRepository = {
  init(): Promise<void>;
  load(sessionId: string): Promise<Session>;
  save(sessionId: string, session: Session, options?: SaveSessionOptions): Promise<Session>;
};
