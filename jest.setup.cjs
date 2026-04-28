class StorageMock {
  constructor() {
    this.store = new Map();
  }

  clear() {
    this.store.clear();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key) {
    this.store.delete(key);
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  get length() {
    return this.store.size;
  }
}

if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: new StorageMock(),
    configurable: true,
  });
}

// env.ts 在模块加载时校验必填字段；测试环境注入默认值
process.env.DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || 'test-key';
process.env.DOUBAO_BASE_URL = process.env.DOUBAO_BASE_URL || 'https://test.example.com/v1';
process.env.DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'test-model';