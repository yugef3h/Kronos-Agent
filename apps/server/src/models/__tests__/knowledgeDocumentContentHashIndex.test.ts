import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import { createKnowledgeDataset } from '../../knowledgeDatasetStore.js';
import { getKnowledgeContentHashIndexPath } from '../../knowledgeDocumentContentHashIndex.js';
import { importKnowledgeDocument } from '../../knowledgeDocumentStore.js';

const toDataUrl = (mimeType: string, text: string) =>
  `data:${mimeType};base64,${Buffer.from(text, 'utf-8').toString('base64')}`;

describe('knowledgeDocumentContentHashIndex', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kronos-content-hash-'));
    process.env.KNOWLEDGE_DATASETS_DIR = join(tempDir, 'knowledge-datasets');
    process.env.KNOWLEDGE_DATASETS_STORE_PATH = join(tempDir, 'knowledge-datasets.json');
  });

  afterEach(async () => {
    delete process.env.KNOWLEDGE_DATASETS_DIR;
    delete process.env.KNOWLEDGE_DATASETS_STORE_PATH;
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('writes per-dataset content-hash-index.json from processed text', async () => {
    const dataset = await createKnowledgeDataset({
      name: 'hash-index',
      description: 'test',
      is_multimodal: false,
      doc_metadata: [],
    });

    await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'a.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', '统一索引测试'),
    });

    const indexPath = getKnowledgeContentHashIndexPath(dataset.id);
    const indexRaw = await readFile(indexPath, 'utf-8');
    const index = JSON.parse(indexRaw) as {
      version: number;
      entries: Record<string, { fileName: string }>;
    };
    expect(index.version).toBe(1);
    expect(Object.keys(index.entries)).toHaveLength(1);
    expect(Object.values(index.entries)[0]?.fileName).toBe('a.txt');
    expect(Object.keys(index.entries)[0]).toHaveLength(64);

    const documentsPath = join(tempDir, 'knowledge-datasets', dataset.id, 'documents', 'documents.json');
    const documentsRaw = await readFile(documentsPath, 'utf-8');
    expect(documentsRaw).not.toContain('contentHash');
  });
});
