import { mkdir, readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { SessionConflictError } from './sessionConflictError.js';
import { createEmptySession, normalizeSession, parseStoredSession } from './normalizeSession.js';
import { SESSION_DATA_DIR } from './sessionPaths.js';
import { sessionFilePath, writeSessionFile } from './writeSessionFile.js';
import type { SaveSessionOptions, SessionRepository } from './sessionRepository.js';
import type { Session } from './types.js';

export class FileSessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();

  async init(): Promise<void> {
    try {
      await mkdir(SESSION_DATA_DIR, { recursive: true });
      const files = await readdir(SESSION_DATA_DIR);
      let loaded = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const sessionId = file.slice(0, -5);
        try {
          const filePath = join(SESSION_DATA_DIR, file);
          const [raw, fileStat] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);
          const data = parseStoredSession(JSON.parse(raw), fileStat.mtimeMs);
          this.sessions.set(sessionId, data);
          loaded += 1;
        } catch {
          console.warn(`[sessionStore] 跳过损坏的 session 文件: ${file}`);
        }
      }

      console.warn(`[sessionStore:file] 已加载 ${loaded} 个 session`);
    } catch (err) {
      console.warn('[sessionStore:file] init 失败:', err);
    }
  }

  getSessionSync(sessionId: string): Session {
    return this.sessions.get(sessionId) ?? createEmptySession();
  }

  async load(sessionId: string): Promise<Session> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return { ...existing, messages: [...existing.messages] };
    }

    const created = createEmptySession();
    this.sessions.set(sessionId, created);
    return { ...created, messages: [] };
  }

  async save(
    sessionId: string,
    session: Session,
    options: SaveSessionOptions = {},
  ): Promise<Session> {
    const current = this.sessions.get(sessionId) ?? createEmptySession();
    const expectedVersion = options.expectedVersion ?? session.version;

    if (expectedVersion !== current.version) {
      throw new SessionConflictError(sessionId, expectedVersion, current.version);
    }

    const next = normalizeSession(
      {
        ...session,
        version: current.version + 1,
      },
      Date.now(),
    );

    this.sessions.set(sessionId, next);

    try {
      await writeSessionFile(sessionId, next);
    } catch (err) {
      console.warn(`[sessionStore:file] 持久化 session ${sessionId} 失败:`, err);
    }

    return { ...next, messages: [...next.messages] };
  }
}
