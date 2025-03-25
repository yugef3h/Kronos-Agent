import {
  getCachedLocalStorage,
  getNextDayStartTimestamp,
  setCachedLocalStorage,
} from './localStorageCache';

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) || null : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('localStorageCache', () => {
  const originalWindow = global.window;
  const storage = new LocalStorageMock();

  beforeEach(() => {
    Object.defineProperty(global, 'window', {
      value: { localStorage: storage },
      configurable: true,
      writable: true,
    });
    storage.clear();
  });

  afterAll(() => {
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it('reads unexpired cached values', () => {
    setCachedLocalStorage('topics', ['a', 'b'], Date.now() + 10_000);
    expect(getCachedLocalStorage<string[]>('topics')).toEqual(['a', 'b']);
  });

  it('returns null and clears expired values', () => {
    setCachedLocalStorage('topics', ['a'], Date.now() - 1);
    expect(getCachedLocalStorage<string[]>('topics')).toBeNull();
    expect(storage.getItem('topics')).toBeNull();
  });

  it('computes the next day start timestamp', () => {
    expect(getNextDayStartTimestamp(new Date('2026-03-20T10:30:00+08:00').getTime())).toBe(
      new Date('2026-03-21T00:00:00+08:00').getTime(),
    );
  });
});