/** Vite `import.meta.env` 在 Jest(CJS) 中不可用，用惰性求值兼容双环境 */
export const isViteDev = (): boolean => {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  try {
    return Boolean(Function('return import.meta?.env?.DEV')());
  } catch {
    return process.env.NODE_ENV !== 'production';
  }
};
