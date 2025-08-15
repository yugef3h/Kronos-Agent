import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';

export type KnowledgeMetadataField = {
  key: string;
  label: string;
};

export type KnowledgeDatasetRecord = {
  id: string;
  name: string;
  description: string;
  is_multimodal: boolean;
  doc_metadata: KnowledgeMetadataField[];
  documentCount: number;
  chunkCount: number;
  createdAt: number;
  updatedAt: number;
};

export type KnowledgeDatasetInput = {
  name: string;
  description: string;
  is_multimodal: boolean;
  doc_metadata: KnowledgeMetadataField[];
};

const resolveDefaultDataFile = () => {
  const cwd = process.cwd();
  const repoScopedFile = join(cwd, 'apps/server/data/knowledge-datasets.json');
  if (existsSync(join(cwd, 'apps/server'))) {
    return repoScopedFile;
  }

  return join(cwd, 'data/knowledge-datasets.json');
};

const DEFAULT_DATA_FILE = resolveDefaultDataFile();

const datasets = new Map<string, KnowledgeDatasetRecord>();

let initialized = false;
let persistQueue = Promise.resolve();

const getDataFilePath = () => {
  return process.env.KNOWLEDGE_DATASETS_STORE_PATH || DEFAULT_DATA_FILE;
};

const cloneDataset = (dataset: KnowledgeDatasetRecord): KnowledgeDatasetRecord => ({
  ...dataset,
  doc_metadata: dataset.doc_metadata.map((field) => ({ ...field })),
});

const sortDatasets = (items: KnowledgeDatasetRecord[]) => {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
};

const slugify = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || `dataset-${Date.now().toString(36)}`;
};

const normalizeMetadataField = (field: Partial<KnowledgeMetadataField>, index: number): KnowledgeMetadataField | null => {
  const key = typeof field.key === 'string' ? field.key.trim() : '';
  const label = typeof field.label === 'string' ? field.label.trim() : '';

  if (!key) {
    return null;
  }

  return {
    key,
    label: label || `字段 ${index + 1}`,
  };
};

const normalizeDatasetRecord = (value: unknown): KnowledgeDatasetRecord | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') {
    return null;
  }

  const metadata = Array.isArray(raw.doc_metadata)
    ? raw.doc_metadata
        .map((field, index) => normalizeMetadataField(field as Partial<KnowledgeMetadataField>, index))
        .filter((field): field is KnowledgeMetadataField => field !== null)
    : [];

  return {
    id: raw.id,
    name: raw.name.trim(),
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    is_multimodal: Boolean(raw.is_multimodal),
    doc_metadata: metadata,
    documentCount: typeof raw.documentCount === 'number' && Number.isFinite(raw.documentCount)
      ? Math.max(0, Math.floor(raw.documentCount))
      : 0,
    chunkCount: typeof raw.chunkCount === 'number' && Number.isFinite(raw.chunkCount)
      ? Math.max(0, Math.floor(raw.chunkCount))
      : 0,
    createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
      ? raw.createdAt
      : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : Date.now(),
  };
};

const persistDatasets = async () => {
  const filePath = getDataFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(sortDatasets([...datasets.values()])), 'utf-8');
};

const enqueuePersist = async () => {
  persistQueue = persistQueue
    .then(async () => {
      await persistDatasets();
    })
    .catch((error) => {
      console.warn('[knowledgeDatasetStore] persist failed:', error);
    });

  await persistQueue;
};

const ensureInitialized = async () => {
  if (!initialized) {
    await initKnowledgeDatasetStore();
  }
};

export const initKnowledgeDatasetStore = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  const filePath = getDataFilePath();

  try {
    await mkdir(dirname(filePath), { recursive: true });

    let nextDatasets: KnowledgeDatasetRecord[] = [];

    try {
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown[];
      nextDatasets = Array.isArray(parsed)
        ? parsed
            .map((item) => normalizeDatasetRecord(item))
            .filter((item): item is KnowledgeDatasetRecord => item !== null)
        : [];
    } catch {
      nextDatasets = [];
    }

    datasets.clear();
    nextDatasets.forEach((dataset) => datasets.set(dataset.id, dataset));
    initialized = true;

    if (!nextDatasets.length) {
      await persistDatasets();
    }
  } catch (error) {
    console.warn('[knowledgeDatasetStore] init failed:', error);
    datasets.clear();
    initialized = true;
  }
};

export const listKnowledgeDatasets = async (): Promise<KnowledgeDatasetRecord[]> => {
  await ensureInitialized();
  return sortDatasets([...datasets.values()]).map(cloneDataset);
};

export const getKnowledgeDatasetById = async (datasetId: string): Promise<KnowledgeDatasetRecord | null> => {
  await ensureInitialized();
  const dataset = datasets.get(datasetId);
  return dataset ? cloneDataset(dataset) : null;
};

export const createKnowledgeDataset = async (input: KnowledgeDatasetInput): Promise<KnowledgeDatasetRecord> => {
  await ensureInitialized();

  const now = Date.now();
  const baseId = slugify(input.name);
  let nextId = baseId;
  let suffix = 1;

  while (datasets.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }

  const dataset: KnowledgeDatasetRecord = {
    id: nextId,
    name: input.name.trim(),
    description: input.description.trim(),
    is_multimodal: input.is_multimodal,
    doc_metadata: input.doc_metadata.map((field) => ({ ...field })),
    documentCount: 0,
    chunkCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  datasets.set(dataset.id, dataset);
  await enqueuePersist();

  return cloneDataset(dataset);
};

export const updateKnowledgeDataset = async (
  datasetId: string,
  input: KnowledgeDatasetInput,
): Promise<KnowledgeDatasetRecord> => {
  await ensureInitialized();

  const existing = datasets.get(datasetId);
  if (!existing) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const updated: KnowledgeDatasetRecord = {
    ...existing,
    name: input.name.trim(),
    description: input.description.trim(),
    is_multimodal: input.is_multimodal,
    doc_metadata: input.doc_metadata.map((field) => ({ ...field })),
    updatedAt: Date.now(),
  };

  datasets.set(datasetId, updated);
  await enqueuePersist();

  return cloneDataset(updated);
};

export const deleteKnowledgeDataset = async (datasetId: string): Promise<void> => {
  await ensureInitialized();

  if (!datasets.has(datasetId)) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  datasets.delete(datasetId);
  await enqueuePersist();
};

export const updateKnowledgeDatasetStats = async (
  datasetId: string,
  stats: { documentCount?: number; chunkCount?: number },
): Promise<KnowledgeDatasetRecord> => {
  await ensureInitialized();

  const existing = datasets.get(datasetId);
  if (!existing) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const updated: KnowledgeDatasetRecord = {
    ...existing,
    documentCount: typeof stats.documentCount === 'number' ? Math.max(0, Math.floor(stats.documentCount)) : existing.documentCount,
    chunkCount: typeof stats.chunkCount === 'number' ? Math.max(0, Math.floor(stats.chunkCount)) : existing.chunkCount,
    updatedAt: Date.now(),
  };

  datasets.set(datasetId, updated);
  await enqueuePersist();
  return cloneDataset(updated);
};

export const resetKnowledgeDatasetStoreForTests = () => {
  datasets.clear();
  initialized = false;
  persistQueue = Promise.resolve();
};