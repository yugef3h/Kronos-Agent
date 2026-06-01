import type { CacheEntry } from '../types/cacheEntry.js';
import type { CacheStore } from './cacheStore.js';

/** LRU 双向链表节点 */
type LruNode = {
  key: string;
  entry: CacheEntry<unknown>;
  prev: LruNode | null;
  next: LruNode | null;
};

/** 默认最大缓存条目数 */
const DEFAULT_MAX_ENTRIES = 5000;

const resolveMaxEntries = (): number => {
  const env = process.env.AI_CACHE_MAX_ENTRIES?.trim();
  if (!env) {
    return DEFAULT_MAX_ENTRIES;
  }
  const parsed = Number(env);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ENTRIES;
};

const maxEntries = resolveMaxEntries();

/** key → 链表节点索引 */
const index = new Map<string, LruNode>();

/** 双向链表哨兵：head ↔ ... ↔ tail */
let head: LruNode | null = null;
let tail: LruNode | null = null;

const isExpired = (entry: CacheEntry<unknown>, nowMs: number): boolean => entry.expiresAt <= nowMs;

/** 从链表中移除节点（不清理 index） */
const unlink = (node: LruNode): void => {
  if (node.prev) {
    node.prev.next = node.next;
  } else {
    head = node.next;
  }
  if (node.next) {
    node.next.prev = node.prev;
  } else {
    tail = node.prev;
  }
  node.prev = null;
  node.next = null;
};

/** 将节点移到链表头部（最近使用） */
const moveToHead = (node: LruNode): void => {
  if (node === head) {
    return;
  }
  unlink(node);
  node.next = head;
  if (head) {
    head.prev = node;
  }
  head = node;
  if (!tail) {
    tail = node;
  }
};

/** 在头部插入新节点 */
const insertHead = (node: LruNode): void => {
  node.next = head;
  if (head) {
    head.prev = node;
  }
  head = node;
  if (!tail) {
    tail = node;
  }
};

/** 移除尾部节点（LRU 淘汰） */
const removeTail = (): void => {
  if (!tail) {
    return;
  }
  index.delete(tail.key);
  if (tail.prev) {
    tail.prev.next = null;
  }
  tail = tail.prev;
  if (!tail) {
    head = null;
  }
};

/** 逐出过期条目 + LRU 超量淘汰 */
const evictIfNeeded = (nowMs: number): void => {
  // 1. 逐出所有过期节点
  let node = tail;
  while (node) {
    const prev = node.prev;
    if (isExpired(node.entry, nowMs)) {
      index.delete(node.key);
      unlink(node);
    }
    node = prev;
  }

  // 2. LRU：超过 maxEntries 从尾部逐出
  while (index.size > maxEntries && tail) {
    removeTail();
  }
};

/** 进程内 LRU + TTL 混合淘汰缓存 */
export const memoryCacheStore: CacheStore = {
  async get(key) {
    const node = index.get(key);
    if (!node) {
      return null;
    }

    const nowMs = Date.now();
    if (isExpired(node.entry, nowMs)) {
      index.delete(key);
      unlink(node);
      return null;
    }

    node.entry.hitCount += 1;
    moveToHead(node);
    return node.entry;
  },

  async set(key, value, ttlMs) {
    const nowMs = Date.now();
    const existing = index.get(key);

    if (existing) {
      existing.entry = {
        key,
        value,
        expiresAt: nowMs + Math.max(ttlMs, 0),
        hitCount: existing.entry.hitCount,
      };
      moveToHead(existing);
      return;
    }

    const node: LruNode = {
      key,
      entry: {
        key,
        value,
        expiresAt: nowMs + Math.max(ttlMs, 0),
        hitCount: 0,
      },
      prev: null,
      next: null,
    };

    index.set(key, node);
    insertHead(node);
    evictIfNeeded(nowMs);
  },

  async delete(key) {
    const node = index.get(key);
    if (!node) {
      return;
    }
    index.delete(key);
    unlink(node);
  },
};

export const clearMemoryCacheStore = (): void => {
  index.clear();
  head = null;
  tail = null;
};

export const listMemoryCacheKeys = (): string[] => [...index.keys()];
