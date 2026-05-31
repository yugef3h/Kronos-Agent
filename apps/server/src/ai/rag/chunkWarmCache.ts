import type { KnowledgeDatasetChunkRecord } from '../../models/knowledgeDocumentStore.js';

type WarmEntry = {
  chunks: KnowledgeDatasetChunkRecord[];
  expiresAt: number;
};

const warmEntries = new Map<string, WarmEntry>();

const DEFAULT_WARM_TTL_MS = 10 * 60 * 1000;

/** 数据集 chunk 预热 LRU */
export const getWarmChunks = (datasetId: string, nowMs = Date.now()): KnowledgeDatasetChunkRecord[] | null => {
  const entry = warmEntries.get(datasetId);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= nowMs) {
    warmEntries.delete(datasetId);
    return null;
  }

  return entry.chunks;
};

export const setWarmChunks = (
  datasetId: string,
  chunks: KnowledgeDatasetChunkRecord[],
  ttlMs = DEFAULT_WARM_TTL_MS,
  nowMs = Date.now(),
): void => {
  warmEntries.set(datasetId, {
    chunks,
    expiresAt: nowMs + ttlMs,
  });
};

export const clearChunkWarmCache = (): void => {
  warmEntries.clear();
};
