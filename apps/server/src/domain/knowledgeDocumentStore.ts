import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import {
  getLocalKnowledgeDatasetsDir,
  isKnowledgeExampleDatasetId,
  resolveKnowledgeDatasetDataDir,
  resolveKnowledgeStoredPath,
} from './knowledgeDataPaths.js';
import { deleteKnowledgeExampleDataset } from '../services/knowledgeExampleStore.js';
import {
  buildKnowledgeDocumentChunks,
  type KnowledgeChunkPreview,
  type KnowledgeDocumentChunkOptions,
  type KnowledgeDocumentPreprocessingRules,
} from '../services/knowledgeChunkingService.js';
import {
  extractKnowledgeKeywords,
  normalizeKeywords,
} from '../services/knowledgeKeywordService.js';
import { computeKnowledgeDocumentContentHash, generateKnowledgeTextHash } from './knowledgeContentHash.js';
import { assertNoDuplicateDocument } from './knowledgeDocumentDuplicate.js';
import { resolveImportPreprocessingRules } from '../services/knowledgeImportPreprocessing.js';
import {
  attachContentHashToDocuments,
  registerContentHashIndexEntry,
  removeDatasetFromContentHashIndex,
  syncKnowledgeContentHashIndex,
} from './knowledgeDocumentContentHashIndex.js';
import {
  getKnowledgeDatasetById,
  updateKnowledgeDatasetStats,
  type KnowledgeDatasetRecord,
} from './knowledgeDatasetStore.js';

export { KnowledgeDocumentDuplicateError } from './knowledgeDocumentDuplicate.js';

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
  /** API 返回时由 content-hash-index.json 注入（Dify 同款正文 hash） */
  contentHash?: string;
};

export type KnowledgeDocumentPreviewItem = {
  fileName: string;
  mimeType: string;
  totalChunks: number;
  preview: KnowledgeChunkPreview[];
};

export type KnowledgeDocumentBlocksResult = {
  document: KnowledgeDocumentRecord;
  chunks: Array<KnowledgeChunkPreview & { metadata: Record<string, string>; keywords: string[] }>;
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
  keywords: string[];
  /** Dify `index_node_hash`：segment 正文 hash */
  indexNodeHash?: string;
  source: {
    title: string;
  };
  /**
   * Step4：LangChain 分支写入的稠密向量（与 `chunks.jsonl` 同行持久化）；自研检索不使用。
   */
  embedding?: number[];
};

type StoredChunkLike = Omit<StoredChunk, 'keywords' | 'embedding'> & { keywords?: unknown; embedding?: unknown };

export type KnowledgeDatasetChunkRecord = {
  chunk: StoredChunk;
  document: KnowledgeDocumentRecord;
};

const getDatasetsDir = () => {
  if (process.env.KNOWLEDGE_DATASETS_DIR) {
    return process.env.KNOWLEDGE_DATASETS_DIR;
  }
  return getLocalKnowledgeDatasetsDir();
};

const getDatasetDir = (datasetId: string) => resolveKnowledgeDatasetDataDir(datasetId);
const getDocumentsIndexPath = (datasetId: string) => join(getDatasetDir(datasetId), 'documents', 'documents.json');

const resolveDocumentFilePath = (datasetId: string, storedPath: string): string =>
  resolveKnowledgeStoredPath(datasetId, storedPath);

const ensureDatasetDirectories = async (datasetId: string) => {
  const documentsDir = join(getDatasetDir(datasetId), 'documents');
  await mkdir(documentsDir, { recursive: true });
};

export const readKnowledgeDocumentsIndex = async (datasetId: string): Promise<KnowledgeDocumentRecord[]> => {
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

const readStoredChunks = async (datasetId: string, chunkPath: string): Promise<StoredChunk[]> => {
  const raw = await readFile(resolveDocumentFilePath(datasetId, chunkPath), 'utf-8');

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parsed = JSON.parse(line) as StoredChunkLike;

      return {
        ...parsed,
        keywords: Array.isArray(parsed.keywords)
          ? normalizeKeywords(parsed.keywords.filter((item): item is string => typeof item === 'string'))
          : extractKnowledgeKeywords(parsed.text),
        embedding: Array.isArray(parsed.embedding) && parsed.embedding.every((n: unknown) => typeof n === 'number')
          ? parsed.embedding as number[]
          : undefined,
      } satisfies StoredChunk;
    })
    .sort((left, right) => left.index - right.index);
};

const writeStoredChunks = async (datasetId: string, chunkPath: string, chunks: StoredChunk[]) => {
  await writeFile(
    resolveDocumentFilePath(datasetId, chunkPath),
    chunks.map((chunk) => JSON.stringify(chunk)).join('\n'),
    'utf-8',
  );
};

/** Step4：按 chunk id 合并向量到既有 `chunks.jsonl` 行，供 LangChain 检索读盘或增量更新。 */
export const mergeEmbeddingsIntoChunkFile = async (
  datasetId: string,
  chunkPath: string,
  embeddingsByChunkId: Record<string, number[]>,
): Promise<void> => {
  if (!Object.keys(embeddingsByChunkId).length) {
    return;
  }

  const chunks = await readStoredChunks(datasetId, chunkPath);
  const next = chunks.map((chunk) => {
    const emb = embeddingsByChunkId[chunk.id];
    if (!emb?.length) {
      return chunk;
    }
    return { ...chunk, embedding: emb };
  });
  await writeStoredChunks(datasetId, chunkPath, next);
};

const buildPreviewText = (text: string) => {
  return text.length > 220 ? `${text.slice(0, 220).trim()}...` : text;
};

export const persistImportedDocument = async (params: {
  dataset: KnowledgeDatasetRecord;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  extractedText: string;
  chunks: KnowledgeChunkPreview[];
  metadata: Record<string, string>;
  contentHash?: string;
}) => {
  const contentHash = params.contentHash ?? computeKnowledgeDocumentContentHash(params.extractedText);
  await assertNoDuplicateDocument({
    datasetId: params.dataset.id,
    fileName: params.fileName,
    contentHash,
    dataset: params.dataset,
    extractedText: params.extractedText,
  });

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
    keywords: extractKnowledgeKeywords(chunk.text),
    indexNodeHash: generateKnowledgeTextHash(chunk.text),
    source: {
      title: params.fileName,
    },
  }));

  await writeStoredChunks(params.dataset.id, chunksFilePath, storedChunks);
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

  const records = await readKnowledgeDocumentsIndex(params.dataset.id);
  const nextRecords = [record, ...records].sort((left, right) => right.updatedAt - left.updatedAt);
  await writeDocumentsIndex(params.dataset.id, nextRecords);
  await registerContentHashIndexEntry(params.dataset.id, contentHash, {
    documentId,
    fileName: params.fileName,
    createdAt: now,
  });
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

  const records = await readKnowledgeDocumentsIndex(datasetId);
  const index = await syncKnowledgeContentHashIndex(datasetId, records);
  return attachContentHashToDocuments(records, index);
};

export const getKnowledgeDocumentBlocks = async (
  datasetId: string,
  documentId: string,
): Promise<KnowledgeDocumentBlocksResult> => {
  const dataset = await getKnowledgeDatasetById(datasetId);
  if (!dataset) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const records = await readKnowledgeDocumentsIndex(datasetId);
  const index = await syncKnowledgeContentHashIndex(datasetId, records);
  const documents = attachContentHashToDocuments(records, index);
  const document = documents.find((item) => item.id === documentId);
  if (!document) {
    throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
  }

  const chunks = (await readStoredChunks(datasetId, document.chunkPath))
    .map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      text: chunk.text,
      tokenCount: chunk.tokenCount,
      charCount: chunk.charCount,
      metadata: { ...chunk.metadata },
      keywords: [...chunk.keywords],
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

  const records = await readKnowledgeDocumentsIndex(datasetId);
  const index = await syncKnowledgeContentHashIndex(datasetId, records);
  const documents = attachContentHashToDocuments(records, index);
  const results = await Promise.all(
    documents.map(async (document) => {
      const chunks = await readStoredChunks(datasetId, document.chunkPath);
      return chunks.map((chunk) => ({
        chunk,
        document,
      }));
    }),
  );

  return results.flat();
};

export const deleteKnowledgeDatasetFiles = async (datasetId: string): Promise<void> => {
  if (isKnowledgeExampleDatasetId(datasetId)) {
    await deleteKnowledgeExampleDataset(datasetId);
    return;
  }
  await rm(join(getDatasetsDir(), datasetId), { recursive: true, force: true });
  await removeDatasetFromContentHashIndex(datasetId);
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

  const preprocessingRules = resolveImportPreprocessingRules(dataset, params.preprocessingRules);
  const result = await buildKnowledgeDocumentChunks({
    ...params,
    preprocessingRules,
  });
  const contentHash = computeKnowledgeDocumentContentHash(result.processedText);
  await assertNoDuplicateDocument({
    datasetId: params.datasetId,
    fileName: params.fileName,
    contentHash,
    dataset,
    extractedText: result.processedText,
    preprocessingRules,
  });

  const persisted = await persistImportedDocument({
    dataset,
    fileName: params.fileName,
    mimeType: result.mimeType,
    buffer: result.buffer,
    extractedText: result.processedText,
    chunks: result.chunks,
    metadata: { ...(params.metadata ?? {}) },
    contentHash,
  });

  return {
    document: persisted.record,
    preview: persisted.preview,
  };
};

export const updateKnowledgeDocumentBlockKeywords = async (params: {
  datasetId: string;
  documentId: string;
  chunkId: string;
  keywords: string[];
}) => {
  const dataset = await getKnowledgeDatasetById(params.datasetId);
  if (!dataset) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const records = await readKnowledgeDocumentsIndex(params.datasetId);
  const document = records.find((item) => item.id === params.documentId);
  if (!document) {
    throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
  }

  const chunks = await readStoredChunks(params.datasetId, document.chunkPath);
  const nextKeywords = normalizeKeywords(params.keywords);
  const targetChunk = chunks.find((chunk) => chunk.id === params.chunkId);

  if (!targetChunk) {
    throw new Error('KNOWLEDGE_DOCUMENT_BLOCK_NOT_FOUND');
  }

  const nextChunks = chunks.map((chunk) => {
    if (chunk.id !== params.chunkId) {
      return chunk;
    }

    return {
      ...chunk,
      keywords: nextKeywords,
    };
  });

  await writeStoredChunks(params.datasetId, document.chunkPath, nextChunks);

  const updatedAt = Date.now();
  const nextRecords = records.map((item) => {
    if (item.id !== document.id) {
      return item;
    }

    return {
      ...item,
      updatedAt,
    };
  });
  await writeDocumentsIndex(params.datasetId, nextRecords);

  return {
    document: nextRecords.find((item) => item.id === document.id) ?? { ...document, updatedAt },
    chunk: {
      ...targetChunk,
      keywords: nextKeywords,
    },
  };
};