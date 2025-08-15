import { existsSync } from 'fs';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { dirname, extname, join } from 'path';
import { extractDocumentText } from '../services/documentTextExtractor.js';
import { parseFileDataUrl } from '../services/fileAnalysisHelpers.js';
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
};

export type KnowledgeChunkPreview = {
  id: string;
  index: number;
  text: string;
  tokenCount: number;
  charCount: number;
};

type StoredChunk = {
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

const estimateTokenCount = (text: string) => {
  return Math.max(1, Math.ceil(text.length / 4));
};

const splitTextToChunks = (text: string, maxTokens: number, chunkOverlap: number): KnowledgeChunkPreview[] => {
  const maxChars = Math.max(200, maxTokens * 4);
  const overlapChars = Math.max(0, chunkOverlap * 4);
  const normalized = text.replace(/\r\n/g, '\n').trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks: KnowledgeChunkPreview[] = [];
  let current = '';

  const pushChunk = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    chunks.push({
      id: `chunk_${chunks.length}`,
      index: chunks.length,
      text: trimmed,
      charCount: trimmed.length,
      tokenCount: estimateTokenCount(trimmed),
    });
  };

  paragraphs.forEach((paragraph) => {
    if (paragraph.length > maxChars) {
      if (current) {
        pushChunk(current);
        current = '';
      }

      let start = 0;
      while (start < paragraph.length) {
        const end = Math.min(start + maxChars, paragraph.length);
        pushChunk(paragraph.slice(start, end));
        if (end >= paragraph.length) {
          break;
        }
        start = Math.max(end - overlapChars, start + 1);
      }
      return;
    }

    const nextValue = current ? `${current}\n\n${paragraph}` : paragraph;
    if (nextValue.length > maxChars) {
      pushChunk(current);
      current = paragraph;
      return;
    }

    current = nextValue;
  });

  if (current) {
    pushChunk(current);
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    id: `chunk_${index}`,
    index,
  }));
};

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
    metadata: {},
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

export const deleteKnowledgeDatasetFiles = async (datasetId: string): Promise<void> => {
  await rm(getDatasetDir(datasetId), { recursive: true, force: true });
};

export const importKnowledgeDocument = async (params: {
  datasetId: string;
  fileName: string;
  fileDataUrl: string;
  mimeType?: string;
  maxTokens?: number;
  chunkOverlap?: number;
}) => {
  const dataset = await getKnowledgeDatasetById(params.datasetId);
  if (!dataset) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const parsedPayload = parseFileDataUrl(params.fileDataUrl);
  const mimeType = params.mimeType?.trim() || parsedPayload.mimeType;
  const extension = extname(params.fileName).replace(/^\./, '').toLowerCase();
  const datasetDir = getDatasetDir(params.datasetId);
  const tempImportPath = join(datasetDir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension || 'bin'}`);

  await mkdir(datasetDir, { recursive: true });
  await writeFile(tempImportPath, parsedPayload.buffer);

  try {
    const extractedText = await extractDocumentText({
      buffer: parsedPayload.buffer,
      mimeType,
      fileName: params.fileName,
      filePath: tempImportPath,
    });

    const chunks = splitTextToChunks(
      extractedText,
      params.maxTokens ?? 500,
      params.chunkOverlap ?? 80,
    );

    if (!extractedText) {
      throw new Error('文件内容为空或暂无法提取文本');
    }

    const persisted = await persistImportedDocument({
      dataset,
      fileName: params.fileName,
      mimeType,
      buffer: parsedPayload.buffer,
      extractedText,
      chunks,
    });

    return {
      document: persisted.record,
      preview: persisted.preview,
    };
  } finally {
    await rm(tempImportPath, { force: true });
  }
};