const TAKEOUT_BINDING_CACHE_KEY = 'kronos.takeout.binding.confirmed.v1';

const getStorage = (): Storage | null => {
  if (typeof globalThis === 'undefined') {
    return null;
  }

  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  return storage || null;
};

export const hasTakeoutBindingConfirmed = (): boolean => {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  return storage.getItem(TAKEOUT_BINDING_CACHE_KEY) === '1';
};

export const setTakeoutBindingConfirmed = (): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(TAKEOUT_BINDING_CACHE_KEY, '1');
};

export const clearTakeoutBindingConfirmedForTest = (): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(TAKEOUT_BINDING_CACHE_KEY);
};
