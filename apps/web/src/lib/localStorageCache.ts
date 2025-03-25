type CachedRecord<T> = {
  value: T;
  expiresAt: number;
};

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }

  return window.localStorage;
};

export const getCachedLocalStorage = <T>(key: string): T | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as CachedRecord<T>;
    if (typeof parsed.expiresAt !== 'number' || Date.now() >= parsed.expiresAt) {
      storage.removeItem(key);
      return null;
    }

    return parsed.value;
  } catch {
    storage.removeItem(key);
    return null;
  }
};

export const setCachedLocalStorage = <T>(key: string, value: T, expiresAt: number): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify({ value, expiresAt }));
};

export const getNextDayStartTimestamp = (now = Date.now()): number => {
  const date = new Date(now);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
};