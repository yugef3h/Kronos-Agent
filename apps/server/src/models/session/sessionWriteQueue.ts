import { SessionConflictError } from './sessionConflictError.js';
import { recordSessionSaveConflict } from './sessionMetrics.js';
import type { Session } from './types.js';

type SaveHandler = (sessionId: string, session: Session) => Promise<Session>;

const queues = new Map<string, Promise<void>>();

/** 同 session 串行落盘，避免乐观锁冲突；不阻塞调用方。 */
export const enqueueSessionSave = (
  sessionId: string,
  session: Session,
  save: SaveHandler,
): void => {
  const previous = queues.get(sessionId) ?? Promise.resolve();

  const current = previous
    .then(() => save(sessionId, session))
    .then((saved) => {
      session.version = saved.version;
      session.messages = saved.messages;
    })
    .catch((error: unknown) => {
      if (error instanceof SessionConflictError) {
        recordSessionSaveConflict({
          sessionId: error.sessionId,
          expectedVersion: error.expectedVersion,
          actualVersion: error.actualVersion,
        });
        throw error;
      }

      const reason = error instanceof Error ? error.message : 'unknown error';
      console.warn(`[sessionStore] async save failed for ${sessionId}: ${reason}`);
    })
    .finally(() => {
      if (queues.get(sessionId) === current) {
        queues.delete(sessionId);
      }
    });

  queues.set(sessionId, current);
};

export const flushSessionSaveQueue = async (sessionId: string): Promise<void> => {
  const pending = queues.get(sessionId);
  if (pending) {
    await pending;
  }
};
