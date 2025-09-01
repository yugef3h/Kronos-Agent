import { existsSync } from 'fs';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { dirname, extname, join } from 'path';
import {
  buildKnowledgeDocumentChunks,
  type KnowledgeChunkPreview,
  type KnowledgeDocumentChunkOptions,
  type KnowledgeDocumentPreprocessingRules,
} from '../services/knowledgeChunkingService.js';
import {
  getKnowledgeDatasetById,
  updateKnowledgeDatasetStats,
  type KnowledgeDatasetRecord,
} from './knowledgeDatasetStore.js';

export type KnowledgeDocumentRecord = {
  id: string;
  datasetId: string;
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  status: 'completed';
  createdAt: number;
  updatedAt: number;
  sourcePath: string;
  parsedTextPath: string;
  chunkPath: string;
  chunkCount: number;
  characterCount: number;
  previewText: string;
  metadata: Record<string, string>;
};

export type KnowledgeDocumentPreviewItem = {
  fileName: string;
  mimeType: string;
  totalChunks: number;
  preview: KnowledgeChunkPreview[];
};

export type KnowledgeDocumentBlocksResult = {
  document: KnowledgeDocumentRecord;
  chunks: Array<KnowledgeChunkPreview & { metadata: Record<string, string> }>;
};

export type StoredChunk = {
  id: string;
  documentId: string;
  datasetId: string;
  index: number;
  text: string;
  tokenCount: number;
  charCount: number;
  metadata: Record<string, string>;
  source: {
    title: string;
  };
};

export type KnowledgeDatasetChunkRecord = {
  chunk: StoredChunk;
  document: KnowledgeDocumentRecord;
};

const resolveDefaultDatasetsDir = () => {
  const cwd = process.cwd();
  const repoScopedDir = join(cwd, 'apps/server/data/knowledge-datasets');
  if (existsSync(join(cwd, 'apps/server'))) {
    return repoScopedDir;
  }

  return join(cwd, 'data/knowledge-datasets');
};

const DEFAULT_DATASETS_DIR = resolveDefaultDatasetsDir();

const getDatasetsDir = () => {
  if (process.env.KNOWLEDGE_DATASETS_DIR) {
    return process.env.KNOWLEDGE_DATASETS_DIR;
  }

  if (process.env.KNOWLEDGE_DATASETS_STORE_PATH) {
    return join(dirname(process.env.KNOWLEDGE_DATASETS_STORE_PATH), 'knowledge-datasets');
  }

  return DEFAULT_DATASETS_DIR;
};

const getDatasetDir = (datasetId: string) => join(getDatasetsDir(), datasetId);
const getDocumentsIndexPath = (datasetId: string) => join(getDatasetDir(datasetId), 'documents', 'documents.json');

const ensureDatasetDirectories = async (datasetId: string) => {
  const documentsDir = join(getDatasetDir(datasetId), 'documents');
  await mkdir(documentsDir, { recursive: true });
};

const readDocumentsIndex = async (datasetId: string): Promise<KnowledgeDocumentRecord[]> => {
  const indexPath = getDocumentsIndexPath(datasetId);

  try {
    const raw = await readFile(indexPath, 'utf-8');
    const parsed = JSON.parse(raw) as KnowledgeDocumentRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeDocumentsIndex = async (datasetId: string, records: KnowledgeDocumentRecord[]) => {
  await ensureDatasetDirectories(datasetId);
  await writeFile(getDocumentsIndexPath(datasetId), JSON.stringify(records, null, 2), 'utf-8');
};

const readStoredChunks = async (chunkPath: string): Promise<StoredChunk[]> => {
  const raw = await readFile(chunkPath, 'utf-8');

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StoredChunk)
    .sort((left, right) => left.index - right.index);
};

const buildPreviewText = (text: string) => {
  return text.length > 220 ? `${text.slice(0, 220).trim()}...` : text;
};

const persistImportedDocument = async (params: {
  dataset: KnowledgeDatasetRecord;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  extractedText: string;
  chunks: KnowledgeChunkPreview[];
  metadata: Record<string, string>;
}) => {
  const now = Date.now();
  const documentId = randomUUID();
  const extension = extname(params.fileName).replace(/^\./, '').toLowerCase();
  const datasetDir = getDatasetDir(params.dataset.id);
  const documentDir = join(datasetDir, 'documents', documentId);
  const sourceDir = join(documentDir, 'source');
  const parsedDir = join(documentDir, 'parsed');
  const chunksDir = join(documentDir, 'chunks');
  const previewDir = join(documentDir, 'preview');

  await Promise.all([
    mkdir(sourceDir, { recursive: true }),
    mkdir(parsedDir, { recursive: true }),
    mkdir(chunksDir, { recursive: true }),
    mkdir(previewDir, { recursive: true }),
  ]);

  const sourceFileName = extension ? `original.${extension}` : 'original';
  const sourceFilePath = join(sourceDir, sourceFileName);
  const parsedFilePath = join(parsedDir, 'content.txt');
  const chunksFilePath = join(chunksDir, 'chunks.jsonl');
  const previewFilePath = join(previewDir, 'preview.json');

  await writeFile(sourceFilePath, params.buffer);
  await writeFile(parsedFilePath, params.extractedText, 'utf-8');

  const storedChunks: StoredChunk[] = params.chunks.map((chunk) => ({
    id: chunk.id,
    documentId,
    datasetId: params.dataset.id,
    index: chunk.index,
    text: chunk.text,
    tokenCount: chunk.tokenCount,
    charCount: chunk.charCount,
    metadata: { ...params.metadata },
    source: {
      title: params.fileName,
    },
  }));

  await writeFile(
    chunksFilePath,
    storedChunks.map((chunk) => JSON.stringify(chunk)).join('\n'),
    'utf-8',
  );
  await writeFile(
    previewFilePath,
    JSON.stringify({ chunks: params.chunks.slice(0, 8) }, null, 2),
    'utf-8',
  );

  const record: KnowledgeDocumentRecord = {
    id: documentId,
    datasetId: params.dataset.id,
    name: params.fileName,
    extension,
    mimeType: params.mimeType,
    size: params.buffer.length,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    sourcePath: sourceFilePath,
    parsedTextPath: parsedFilePath,
    chunkPath: chunksFilePath,
    chunkCount: params.chunks.length,
    characterCount: params.extractedText.length,
    previewText: buildPreviewText(params.extractedText),
    metadata: { ...params.metadata },
  };

  const records = await readDocumentsIndex(params.dataset.id);
  const nextRecords = [record, ...records].sort((left, right) => right.updatedAt - left.updatedAt);
  await writeDocumentsIndex(params.dataset.id, nextRecords);
  await updateKnowledgeDatasetStats(params.dataset.id, {
    documentCount: nextRecords.length,
    chunkCount: nextRecords.reduce((sum, item) => sum + item.chunkCount, 0),
  });

  return {
    record,
    preview: params.chunks.slice(0, 8),
  };
};

export const listKnowledgeDocuments = async (datasetId: string): Promise<KnowledgeDocumentRecord[]> => {
  const dataset = await getKnowledgeDatasetById(datasetId);
  if (!dataset) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  return readDocumentsIndex(datasetId);
};

export const getKnowledgeDocumentBlocks = async (
  datasetId: string,
  documentId: string,
): Promise<KnowledgeDocumentBlocksResult> => {
  const dataset = await getKnowledgeDatasetById(datasetId);
  if (!dataset) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const records = await readDocumentsIndex(datasetId);
  const document = records.find((item) => item.id === documentId);
  if (!document) {
    throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
  }

  const chunks = (await readStoredChunks(document.chunkPath))
    .map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      text: chunk.text,
      tokenCount: chunk.tokenCount,
      charCount: chunk.charCount,
      metadata: { ...chunk.metadata },
    }));

  return {
    document,
    chunks,
  };
};

export const listKnowledgeDatasetChunks = async (
  datasetId: string,
): Promise<KnowledgeDatasetChunkRecord[]> => {
  const dataset = await getKnowledgeDatasetById(datasetId);
  if (!dataset) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const documents = await readDocumentsIndex(datasetId);
  const results = await Promise.all(
    documents.map(async (document) => {
      const chunks = await readStoredChunks(document.chunkPath);
      return chunks.map((chunk) => ({
        chunk,
        document,
      }));
    }),
  );

  return results.flat();
};

export const deleteKnowledgeDatasetFiles = async (datasetId: string): Promise<void> => {
  await rm(getDatasetDir(datasetId), { recursive: true, force: true });
};

export const previewKnowledgeDocuments = async (params: {
  inputs: KnowledgeDocumentChunkOptions[];
  previewLimit?: number;
}) => {
  const previewLimit = Math.max(1, params.previewLimit ?? 40);
  const items: KnowledgeDocumentPreviewItem[] = [];

  for (const input of params.inputs) {
    const result = await buildKnowledgeDocumentChunks(input);
    items.push({
      fileName: input.fileName,
      mimeType: result.mimeType,
      totalChunks: result.chunks.length,
      preview: result.chunks.slice(0, previewLimit),
    });
  }

  return { items };
};

export const importKnowledgeDocument = async (params: {
  datasetId: string;
  fileName: string;
  fileDataUrl: string;
  mimeType?: string;
  maxTokens?: number;
  chunkOverlap?: number;
  separator?: string;
  segmentMaxLength?: number;
  overlapLength?: number;
  preprocessingRules?: KnowledgeDocumentPreprocessingRules;
  metadata?: Record<string, string>;
}) => {
  const dataset = await getKnowledgeDatasetById(params.datasetId);
  if (!dataset) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const result = await buildKnowledgeDocumentChunks(params);

  const persisted = await persistImportedDocument({
    dataset,
    fileName: params.fileName,
    mimeType: result.mimeType,
    buffer: result.buffer,
    extractedText: result.processedText,
    chunks: result.chunks,
    metadata: { ...(params.metadata ?? {}) },
  });

  return {
    document: persisted.record,
    preview: persisted.preview,
  };
};