import { readFile } from 'fs/promises';

import { computeKnowledgeDocumentContentHash } from './knowledgeContentHash.js';
import {
  syncKnowledgeContentHashIndex,
  type KnowledgeContentHashIndexEntry,
} from './knowledgeDocumentContentHashIndex.js';
import { resolveKnowledgeStoredPath } from './knowledgeDataPaths.js';
import { readKnowledgeDocumentsIndex, type KnowledgeDocumentRecord } from './knowledgeDocumentStore.js';
import {
  preprocessDocumentText,
  type KnowledgeDocumentPreprocessingRules,
} from '../services/knowledgeChunkingService.js';
import { resolveImportPreprocessingRules } from '../services/knowledgeImportPreprocessing.js';
import type { KnowledgeDatasetRecord } from './knowledgeDatasetStore.js';

export class KnowledgeDocumentDuplicateError extends Error {
  readonly code = 'KNOWLEDGE_DOCUMENT_DUPLICATE';

  constructor(
    readonly fileName: string,
    readonly existingDocumentName: string,
  ) {
    super('KNOWLEDGE_DOCUMENT_DUPLICATE');
    this.name = 'KnowledgeDocumentDuplicateError';
  }
}

const readStoredDocumentContentHash = async (
  datasetId: string,
  document: KnowledgeDocumentRecord,
): Promise<string | null> => {
  if (!document.parsedTextPath) {
    return null;
  }

  try {
    const text = await readFile(resolveKnowledgeStoredPath(datasetId, document.parsedTextPath), 'utf-8');
    if (!text.trim()) {
      return null;
    }
    return computeKnowledgeDocumentContentHash(text);
  } catch {
    return null;
  }
};

export const findDocumentByContentHash = async (
  datasetId: string,
  contentHash: string,
): Promise<KnowledgeContentHashIndexEntry | null> => {
  const documents = await readKnowledgeDocumentsIndex(datasetId);

  for (const document of documents) {
    const storedHash = await readStoredDocumentContentHash(datasetId, document);
    if (storedHash === contentHash) {
      return {
        documentId: document.id,
        fileName: document.name,
        createdAt: document.createdAt,
      };
    }
  }

  const index = await syncKnowledgeContentHashIndex(datasetId, documents);
  return index.entries[contentHash] ?? null;
};

export const assertNoDuplicateDocument = async (params: {
  datasetId: string;
  fileName: string;
  contentHash: string;
  dataset?: KnowledgeDatasetRecord;
  extractedText?: string;
  preprocessingRules?: KnowledgeDocumentPreprocessingRules;
}): Promise<void> => {
  const documents = await readKnowledgeDocumentsIndex(params.datasetId);
  const alternateHashes = new Set<string>([params.contentHash]);

  if (params.dataset && params.extractedText?.trim()) {
    const datasetRules = resolveImportPreprocessingRules(params.dataset, undefined);
    const canonicalText = preprocessDocumentText(params.extractedText, datasetRules);
    alternateHashes.add(computeKnowledgeDocumentContentHash(canonicalText));

    if (params.preprocessingRules) {
      const requestRules = resolveImportPreprocessingRules(params.dataset, params.preprocessingRules);
      const requestText = preprocessDocumentText(params.extractedText, requestRules);
      alternateHashes.add(computeKnowledgeDocumentContentHash(requestText));
    }
  }

  for (const document of documents) {
    const storedHash = await readStoredDocumentContentHash(params.datasetId, document);
    if (!storedHash) {
      continue;
    }

    if (alternateHashes.has(storedHash)) {
      throw new KnowledgeDocumentDuplicateError(params.fileName, document.name);
    }
  }

  await syncKnowledgeContentHashIndex(params.datasetId, documents);
};
