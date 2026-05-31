import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from '@jest/globals';
import { createEmptySession } from '../normalizeSession.js';

describe('writeSessionFile', () => {
  it('keeps valid JSON under concurrent writes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kronos-session-write-'));
    process.env.KRONOS_SESSION_DATA_DIR = dir;

    try {
      const { writeSessionFile } = await import('../writeSessionFile.js');
      const sessionId = 'concurrent-save';

      await Promise.all(
        Array.from({ length: 20 }, (_, index) => {
          const session = createEmptySession();
          session.version = index + 1;
          session.messages.push({
            role: 'user',
            content: `message-${index}`,
            timestamp: Date.now() + index,
          });
          return writeSessionFile(sessionId, session);
        }),
      );

      const raw = await readFile(join(dir, `${sessionId}.json`), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
      expect(raw.endsWith('}')).toBe(true);
    } finally {
      delete process.env.KRONOS_SESSION_DATA_DIR;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
