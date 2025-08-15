import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import * as xlsx from 'xlsx';
import {
  createKnowledgeDataset,
  initKnowledgeDatasetStore,
  listKnowledgeDatasets,
  resetKnowledgeDatasetStoreForTests,
} from './knowledgeDatasetStore';
import { importKnowledgeDocument, listKnowledgeDocuments } from './knowledgeDocumentStore';

const toDataUrl = (mimeType: string, value: Buffer | string) => {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

describe('knowledgeDocumentStore', () => {
  let tempDir = '';
  let storeFilePath = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kronos-knowledge-documents-'));
    storeFilePath = join(tempDir, 'knowledge-datasets.json');
    process.env.KNOWLEDGE_DATASETS_STORE_PATH = storeFilePath;
    resetKnowledgeDatasetStoreForTests();
    await initKnowledgeDatasetStore();
  });

  afterEach(async () => {
    resetKnowledgeDatasetStoreForTests();
    delete process.env.KNOWLEDGE_DATASETS_STORE_PATH;
    delete process.env.KNOWLEDGE_DATASETS_DIR;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('imports txt documents and updates dataset counters', async () => {
    const dataset = await createKnowledgeDataset({
      name: '本地帮助中心',
      description: '测试知识库',
      is_multimodal: false,
      doc_metadata: [],
    });

    const result = await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'guide.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', '第一段内容。\n\n第二段内容。\n\n第三段内容。'),
      maxTokens: 20,
      chunkOverlap: 4,
    });

    expect(result.document.name).toBe('guide.txt');
    expect(result.preview.length).toBeGreaterThan(0);

    const documents = await listKnowledgeDocuments(dataset.id);
    expect(documents).toHaveLength(1);

    const datasets = await listKnowledgeDatasets();
    const updated = datasets.find((item) => item.id === dataset.id);
    expect(updated?.documentCount).toBe(1);
    expect(updated?.chunkCount).toBeGreaterThan(0);
  });

  it('imports xlsx documents as text rows', async () => {
    const dataset = await createKnowledgeDataset({
      name: '表格知识库',
      description: 'Excel 导入测试',
      is_multimodal: false,
      doc_metadata: [],
    });

    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['问题', '答案'],
      ['退款多久到账', '通常 1 到 3 个工作日'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'FAQ');
    const workbookBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const result = await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'faq.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileDataUrl: toDataUrl('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', workbookBuffer),
    });

    expect(result.preview[0]?.text.includes('退款多久到账')).toBe(true);

    const indexPath = join(tempDir, 'knowledge-datasets', dataset.id, 'documents', 'documents.json');
    const persisted = JSON.parse(await readFile(indexPath, 'utf-8')) as Array<{ name: string }>;
    expect(persisted[0]?.name).toBe('faq.xlsx');
  });
});