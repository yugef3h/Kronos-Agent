import type { CacheStore } from './cacheStore.js';
import { listMemoryCacheKeys, memoryCacheStore } from './memoryCacheStore.js';

/** C-09: 清理过期条目（memory 主动扫描；redis 依赖 TTL） */
export const evictExpiredEntries = async (store: CacheStore = memoryCacheStore): Promise<number> => {
  if (store !== memoryCacheStore) {
    return 0;
  }

  let removed = 0;
  for (const key of listMemoryCacheKeys()) {
    const entry = await store.get(key);
    if (!entry) {
      removed += 1;
    }
  }

  return removed;
};
