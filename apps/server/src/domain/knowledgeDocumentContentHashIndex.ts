import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

import {
  getLocalKnowledgeDatasetsDir,
  resolveKnowledgeDatasetDataDir,
  resolveKnowledgeStoredPath,
} from './knowledgeDataPaths.js';
import { computeKnowledgeDocumentContentHash } from './knowledgeContentHash.js';
import type { KnowledgeDocumentRecord } from './knowledgeDocumentStore.js';

export type KnowledgeContentHashIndexEntry = {
  documentId: string;
  fileName: string;
  createdAt: number;
};

export type KnowledgeContentHashIndex = {
  version: 1;
  entries: Record<string, KnowledgeContentHashIndexEntry>;
};

const INDEX_VERSION = 1 as const;

/** 每库一个索引：`knowledge-datasets/{datasetId}/content-hash-index.json` */
export const getKnowledgeContentHashIndexPath = (datasetId: string): string =>
  join(resolveKnowledgeDatasetDataDir(datasetId), 'content-hash-index.json');

const getGlobalLegacyIndexPath = (): string =>
  join(getLocalKnowledgeDatasetsDir(), 'md5-index.json');

const getLegacyDocumentsMd5IndexPath = (datasetId: string): string =>
  join(resolveKnowledgeDatasetDataDir(datasetId), 'documents', 'md5-index.json');

const emptyIndex = (): KnowledgeContentHashIndex => ({
  version: INDEX_VERSION,
  entries: {},
});

const readDatasetContentHashIndex = async (datasetId: string): Promise<KnowledgeContentHashIndex> => {
  const indexPath = getKnowledgeContentHashIndexPath(datasetId);

  try {
    const raw = await readFile(indexPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<KnowledgeContentHashIndex>;
    if (parsed?.version === INDEX_VERSION && parsed.entries && typeof parsed.entries === 'object') {
      return { version: INDEX_VERSION, entries: { ...parsed.entries } };
    }
  } catch {
    // fall through
  }

  return emptyIndex();
};

const writeDatasetContentHashIndex = async (
  datasetId: string,
  index: KnowledgeContentHashIndex,
): Promise<void> => {
  const indexPath = getKnowledgeContentHashIndexPath(datasetId);
  await mkdir(dirname(indexPath), { recursive: true });
  await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
};

const mergeLegacyIndexes = async (
  datasetId: string,
  index: KnowledgeContentHashIndex,
): Promise<boolean> => {
  let changed = false;

  const mergeEntries = (entries: Record<string, KnowledgeContentHashIndexEntry> | undefined) => {
    if (!entries || typeof entries !== 'object') {
      return;
    }
    for (const [hash, entry] of Object.entries(entries)) {
      if (!entry?.documentId) {
        continue;
      }
      index.entries[hash] = entry;
      changed = true;
    }
  };

  try {
    const globalRaw = await readFile(getGlobalLegacyIndexPath(), 'utf-8');
    const globalParsed = JSON.parse(globalRaw) as {
      datasets?: Record<string, Record<string, KnowledgeContentHashIndexEntry>>;
      entries?: Record<string, KnowledgeContentHashIndexEntry>;
    };
    if (globalParsed.datasets?.[datasetId]) {
      mergeEntries(globalParsed.datasets[datasetId]);
    }
  } catch {
    // no global legacy
  }

  try {
    const legacyRaw = await readFile(getLegacyDocumentsMd5IndexPath(datasetId), 'utf-8');
    const legacyParsed = JSON.parse(legacyRaw) as {
      entries?: Record<string, KnowledgeContentHashIndexEntry>;
    };
    mergeEntries(legacyParsed.entries);
    await rm(getLegacyDocumentsMd5IndexPath(datasetId), { force: true });
    changed = true;
  } catch {
    // no per-documents legacy
  }

  return changed;
};

const resolveParsedTextPath = (datasetId: string, document: KnowledgeDocumentRecord): string | null => {
  if (!document.parsedTextPath) {
    return null;
  }
  return resolveKnowledgeStoredPath(datasetId, document.parsedTextPath);
};

const computeDocumentContentHash = async (
  datasetId: string,
  document: KnowledgeDocumentRecord,
): Promise<string | null> => {
  const parsedPath = resolveParsedTextPath(datasetId, document);
  if (!parsedPath) {
    return null;
  }

  try {
    const text = await readFile(parsedPath, 'utf-8');
    if (!text.trim()) {
      return null;
    }
    return computeKnowledgeDocumentContentHash(text);
  } catch {
    return null;
  }
};

export const syncKnowledgeContentHashIndex = async (
  datasetId: string,
  documents: KnowledgeDocumentRecord[],
): Promise<KnowledgeContentHashIndex> => {
  const index = await readDatasetContentHashIndex(datasetId);
  const legacyMerged = await mergeLegacyIndexes(datasetId, index);
  const entries = { ...index.entries };
  let changed = legacyMerged;

  for (const document of documents) {
    const contentHash = await computeDocumentContentHash(datasetId, document);
    if (!contentHash) {
      continue;
    }

    const existing = entries[contentHash];
    if (
      existing?.documentId === document.id
      && existing.fileName === document.name
      && existing.createdAt === document.createdAt
    ) {
      continue;
    }

    entries[contentHash] = {
      documentId: document.id,
      fileName: document.name,
      createdAt: document.createdAt,
    };
    changed = true;
  }

  const documentIds = new Set(documents.map((item) => item.id));
  for (const [hash, entry] of Object.entries(entries)) {
    if (!documentIds.has(entry.documentId)) {
      delete entries[hash];
      changed = true;
    }
  }

  const nextIndex: KnowledgeContentHashIndex = { version: INDEX_VERSION, entries };

  if (changed) {
    await writeDatasetContentHashIndex(datasetId, nextIndex);
  }

  return nextIndex;
};

export const findContentHashIndexEntry = (
  index: KnowledgeContentHashIndex,
  contentHash: string,
): KnowledgeContentHashIndexEntry | null => index.entries[contentHash] ?? null;

export const registerContentHashIndexEntry = async (
  datasetId: string,
  contentHash: string,
  entry: KnowledgeContentHashIndexEntry,
): Promise<void> => {
  const index = await readDatasetContentHashIndex(datasetId);
  await mergeLegacyIndexes(datasetId, index);
  index.entries[contentHash] = entry;
  await writeDatasetContentHashIndex(datasetId, index);
};

export const removeDatasetFromContentHashIndex = async (datasetId: string): Promise<void> => {
  try {
    await rm(getKnowledgeContentHashIndexPath(datasetId), { force: true });
  } catch {
    // ignore
  }
};

export const attachContentHashToDocuments = (
  documents: KnowledgeDocumentRecord[],
  index: KnowledgeContentHashIndex,
): KnowledgeDocumentRecord[] => {
  const hashByDocumentId = new Map<string, string>();
  for (const [hash, entry] of Object.entries(index.entries)) {
    hashByDocumentId.set(entry.documentId, hash);
  }

  return documents.map((document) => {
    const contentHash = hashByDocumentId.get(document.id);
    if (!contentHash) {
      return document;
    }
    return { ...document, contentHash };
  });
};
