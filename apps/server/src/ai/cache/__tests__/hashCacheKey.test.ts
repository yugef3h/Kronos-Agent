import { hashCacheKey } from '../../../hashCacheKey.js';

describe('hashCacheKey', () => {
  it('is stable for same parts regardless of key order', () => {
    const a = hashCacheKey('prompt', { model: 'm1', prompt: 'hi' });
    const b = hashCacheKey('prompt', { prompt: 'hi', model: 'm1' });
    expect(a).toBe(b);
  });

  it('prefixes layer name', () => {
    const key = hashCacheKey('retrieval', { query: 'q' });
    expect(key.startsWith('retrieval:')).toBe(true);
  });
});
