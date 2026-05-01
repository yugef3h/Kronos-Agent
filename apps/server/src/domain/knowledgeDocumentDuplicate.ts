import { createHash } from 'crypto';

import { listKnowledgeDocuments, type KnowledgeDocumentRecord } from './knowledgeDocumentStore.js';

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

export const computeBufferMd5 = (buffer: Buffer): string =>
  createHash('md5').update(buffer).digest('hex');

export const findDocumentByContentMd5 = async (
  datasetId: string,
  contentMd5: string,
): Promise<KnowledgeDocumentRecord | null> => {
  const records = await listKnowledgeDocuments(datasetId);
  return records.find((item) => item.contentMd5 === contentMd5) ?? null;
};

export const assertNoDuplicateDocument = async (
  datasetId: string,
  fileName: string,
  contentMd5: string,
): Promise<void> => {
  const duplicate = await findDocumentByContentMd5(datasetId, contentMd5);
  if (duplicate) {
    throw new KnowledgeDocumentDuplicateError(fileName, duplicate.name);
  }
};
