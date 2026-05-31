import { clearMemoryCacheStore, memoryCacheStore } from '../../memoryCacheStore.js';

describe('memoryCacheStore', () => {
  beforeEach(() => {
    clearMemoryCacheStore();
  });

  it('stores and retrieves values before TTL', async () => {
    await memoryCacheStore.set('k1', { answer: 'ok' }, 60_000);
    const entry = await memoryCacheStore.get('k1');
    expect(entry?.value).toEqual({ answer: 'ok' });
    expect(entry?.hitCount).toBe(1);
  });

  it('returns null after TTL expires', async () => {
    await memoryCacheStore.set('k2', 'v', 1);
    await new Promise((resolve) => { setTimeout(resolve, 5); });
    expect(await memoryCacheStore.get('k2')).toBeNull();
  });
});
