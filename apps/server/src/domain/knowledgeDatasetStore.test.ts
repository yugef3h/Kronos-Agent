import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createKnowledgeDataset,
  deleteKnowledgeDataset,
  initKnowledgeDatasetStore,
  listKnowledgeDatasets,
  resetKnowledgeDatasetStoreForTests,
  updateKnowledgeDataset,
} from './knowledgeDatasetStore';

describe('knowledgeDatasetStore', () => {
  let tempDir = '';
  let storeFilePath = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kronos-knowledge-datasets-'));
    storeFilePath = join(tempDir, 'knowledge-datasets.json');
    process.env.KNOWLEDGE_DATASETS_STORE_PATH = storeFilePath;
    resetKnowledgeDatasetStoreForTests();
  });

  afterEach(async () => {
    resetKnowledgeDatasetStoreForTests();
    delete process.env.KNOWLEDGE_DATASETS_STORE_PATH;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should seed datasets on first init', async () => {
    await initKnowledgeDatasetStore();

    const items = await listKnowledgeDatasets();

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toBeTruthy();
  });

  it('should create, update and delete datasets with persistence', async () => {
    await initKnowledgeDatasetStore();

    const created = await createKnowledgeDataset({
      name: '售后案例库',
      description: '售后 FAQ 与处理记录',
      is_multimodal: false,
      doc_metadata: [
        { key: 'category', label: '分类' },
        { key: 'priority', label: '优先级' },
      ],
    });

    expect(created.id).toContain('售后案例库');
    expect(created.documentCount).toBe(0);

    const updated = await updateKnowledgeDataset(created.id, {
      name: '售后案例知识库',
      description: '更新后的说明',
      is_multimodal: true,
      doc_metadata: [{ key: 'priority', label: '优先级' }],
    });

    expect(updated.name).toBe('售后案例知识库');
    expect(updated.is_multimodal).toBe(true);
    expect(updated.doc_metadata).toEqual([{ key: 'priority', label: '优先级' }]);

    await deleteKnowledgeDataset(created.id);

    const items = await listKnowledgeDatasets();
    expect(items.some((item) => item.id === created.id)).toBe(false);

    const persisted = JSON.parse(await readFile(storeFilePath, 'utf-8')) as Array<{ id: string }>;
    expect(persisted.some((item) => item.id === created.id)).toBe(false);
  });
});