import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockListDocuments = jest.fn();
const mockListChunks = jest.fn();

jest.mock('../models/knowledgeDocumentStore.js', () => ({
  listKnowledgeDocuments: (...args: unknown[]) => mockListDocuments(...args),
  listKnowledgeDatasetChunks: (...args: unknown[]) => mockListChunks(...args),
}));

import { computeKnowledgeDatasetHealth } from '../knowledgeDatasetHealthService.js';

describe('computeKnowledgeDatasetHealth', () => {
  beforeEach(() => {
    mockListDocuments.mockImplementation(async () => [
      { id: 'd1', chunkCount: 0, name: 'empty.txt' },
      { id: 'd2', chunkCount: 2, name: 'ok.txt' },
    ]);
    mockListChunks.mockImplementation(async () => [
      {
        document: { id: 'd2', name: 'ok.txt' },
        chunk: {
          id: 'c1',
          documentId: 'd2',
          datasetId: 'ds',
          index: 0,
          text: 'hello world',
          tokenCount: 3,
          charCount: 11,
          metadata: {},
          keywords: [],
          source: { title: 'ok' },
        },
      },
      {
        document: { id: 'd2', name: 'ok.txt' },
        chunk: {
          id: 'c2',
          documentId: 'd2',
          datasetId: 'ds',
          index: 1,
          text: 'hello world',
          tokenCount: 3,
          charCount: 11,
          metadata: {},
          keywords: [],
          source: { title: 'ok' },
        },
      },
    ]);
  });

  it('flags empty documents, duplicates, and produces a bounded score', async () => {
    const report = await computeKnowledgeDatasetHealth('ds');
    expect(report.emptyDocuments).toBe(1);
    expect(report.exactDuplicateChunkCount).toBe(1);
    expect(report.healthScore).toBeGreaterThanOrEqual(0);
    expect(report.healthScore).toBeLessThanOrEqual(100);
  });
});
