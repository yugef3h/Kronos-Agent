import { describe, expect, it } from '@jest/globals';
import { SessionConflictError } from './sessionConflictError.js';
import { FileSessionRepository } from './fileSessionRepository.js';

describe('FileSessionRepository', () => {
  it('increments version on save', async () => {
    const repo = new FileSessionRepository();
    const session = await repo.load('s-version');
    session.messages.push({ role: 'user', content: 'hello' });
    const saved = await repo.save('s-version', session);
    expect(saved.version).toBe(1);
  });

  it('throws on version conflict', async () => {
    const repo = new FileSessionRepository();
    const session = await repo.load('s-conflict');
    session.messages.push({ role: 'user', content: 'first' });
    await repo.save('s-conflict', session);

    const stale = await repo.load('s-conflict');
    stale.version = 0;
    stale.messages.push({ role: 'assistant', content: 'stale' });

    await expect(repo.save('s-conflict', stale, { expectedVersion: 0 })).rejects.toBeInstanceOf(
      SessionConflictError,
    );
  });
});
