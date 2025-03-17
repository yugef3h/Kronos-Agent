import {
  clearTakeoutBindingConfirmedForTest,
  hasTakeoutBindingConfirmed,
  setTakeoutBindingConfirmed,
} from './localBindingCache';

beforeAll(() => {
  const memoryStorage = new Map<string, string>();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memoryStorage.set(key, String(value));
      },
      removeItem: (key: string) => {
        memoryStorage.delete(key);
      },
      clear: () => {
        memoryStorage.clear();
      },
    } as Storage,
  });
});

describe('takeout local binding cache', () => {
  beforeEach(() => {
    clearTakeoutBindingConfirmedForTest();
  });

  it('is false by default', () => {
    expect(hasTakeoutBindingConfirmed()).toBe(false);
  });

  it('persists confirmed status', () => {
    setTakeoutBindingConfirmed();
    expect(hasTakeoutBindingConfirmed()).toBe(true);
  });
});
