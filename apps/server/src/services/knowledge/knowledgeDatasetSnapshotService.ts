import { existsSync } from 'fs';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { getKnowledgeDatasetById } from '../../../models/knowledgeDatasetStore.js';
import {
  listKnowledgeDatasetChunks,
  listKnowledgeDocuments,
} from '../../../models/knowledgeDocumentStore.js';

const resolveSnapshotRoot = () => {
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'apps/server'))) {
    return join(cwd, 'apps/server/data/knowledge-snapshots');
  }

  return join(cwd, 'data/knowledge-snapshots');
};

const datasetSnapshotDir = (datasetId: string) => join(resolveSnapshotRoot(), datasetId);

export type KnowledgeDatasetSnapshotSummary = {
  id: string;
  datasetId: string;
  createdAt: number;
  documentCount: number;
  chunkCount: number;
  sizeBytes: number;
};

export type KnowledgeDatasetSnapshotPayload = {
  version: 1;
  datasetId: string;
  datasetName: string;
  createdAt: number;
  documents: Array<{
    id: string;
    name: string;
    chunkCount: number;
    characterCount: number;
    extension: string;
  }>;
  chunkStats: {
    total: number;
    medianChars: number;
    p90Chars: number;
  };
};

export const createKnowledgeDatasetSnapshot = async (datasetId: string): Promise<KnowledgeDatasetSnapshotSummary> => {
  const dataset = await getKnowledgeDatasetById(datasetId);
  if (!dataset) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const documents = await listKnowledgeDocuments(datasetId);
  const chunks = await listKnowledgeDatasetChunks(datasetId);
  const charCounts = chunks.map((record) => record.chunk.charCount).sort((a, b) => a - b);
  const medianChars = charCounts.length
    ? charCounts[Math.floor((charCounts.length - 1) / 2)]!
    : 0;
  const p90Index = Math.min(charCounts.length - 1, Math.floor((charCounts.length - 1) * 0.9));
  const p90Chars = charCounts.length ? charCounts[p90Index]! : 0;

  const payload: KnowledgeDatasetSnapshotPayload = {
    version: 1,
    datasetId: dataset.id,
    datasetName: dataset.name,
    createdAt: Date.now(),
    documents: documents.map((document) => ({
      id: document.id,
      name: document.name,
      chunkCount: document.chunkCount,
      characterCount: document.characterCount,
      extension: document.extension,
    })),
    chunkStats: {
      total: chunks.length,
      medianChars,
      p90Chars,
    },
  };

  const id = `${payload.createdAt}-${randomUUID().slice(0, 8)}`;
  const dir = datasetSnapshotDir(datasetId);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${id}.json`);
  const body = JSON.stringify(payload, null, 2);
  await writeFile(filePath, body, 'utf8');

  return {
    id,
    datasetId,
    createdAt: payload.createdAt,
    documentCount: documents.length,
    chunkCount: chunks.length,
    sizeBytes: Buffer.byteLength(body, 'utf8'),
  };
};

export const listKnowledgeDatasetSnapshots = async (datasetId: string): Promise<KnowledgeDatasetSnapshotSummary[]> => {
  const dir = datasetSnapshotDir(datasetId);
  if (!existsSync(dir)) {
    return [];
  }

  const names = await readdir(dir);
  const summaries: KnowledgeDatasetSnapshotSummary[] = [];

  for (const name of names) {
    if (!name.endsWith('.json')) {
      continue;
    }

    const id = name.replace(/\.json$/, '');
    const filePath = join(dir, name);
    const raw = await readFile(filePath, 'utf8');
    const sizeBytes = Buffer.byteLength(raw, 'utf8');
    try {
      const parsed = JSON.parse(raw) as KnowledgeDatasetSnapshotPayload;
      summaries.push({
        id,
        datasetId: parsed.datasetId,
        createdAt: parsed.createdAt,
        documentCount: parsed.documents.length,
        chunkCount: parsed.chunkStats.total,
        sizeBytes,
      });
    } catch {
      summaries.push({
        id,
        datasetId,
        createdAt: 0,
        documentCount: 0,
        chunkCount: 0,
        sizeBytes,
      });
    }
  }

  return summaries.sort((left, right) => right.createdAt - left.createdAt);
};

export const readKnowledgeDatasetSnapshot = async (
  datasetId: string,
  snapshotId: string,
): Promise<KnowledgeDatasetSnapshotPayload> => {
  const filePath = join(datasetSnapshotDir(datasetId), `${snapshotId}.json`);
  if (!existsSync(filePath)) {
    throw new Error('SNAPSHOT_NOT_FOUND');
  }

  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as KnowledgeDatasetSnapshotPayload;
};
