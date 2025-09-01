import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
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

  it('should start with an empty dataset store on first init', async () => {
    await initKnowledgeDatasetStore();

    const items = await listKnowledgeDatasets();

    expect(items).toEqual([]);
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
      indexing_technique: 'high_quality',
      embedding_model: 'doubao-embedding',
      embedding_model_provider: 'ark',
      retrieval_model: {
        search_method: 'hybrid_search',
        top_k: 6,
        score_threshold_enabled: true,
        score_threshold: 0.42,
        reranking_enable: true,
        reranking_model: 'default-rerank',
        reranking_mode: 'model_rerank',
        weights: {
          semantic: 0.6,
          keyword: 0.3,
          full_text: 0.1,
        },
      },
      process_rule: {
        mode: 'custom',
        rules: {
          pre_processing_rules: [
            { id: 'remove_extra_spaces', enabled: true },
            { id: 'remove_urls_emails', enabled: true },
          ],
          segmentation: {
            separator: '\n\n',
            max_tokens: 512,
            chunk_overlap: 50,
            segment_max_length: 1200,
            overlap_length: 80,
          },
          parent_mode: 'paragraph',
          subchunk_segmentation: {
            separator: '\n',
            max_tokens: 256,
            chunk_overlap: 20,
            segment_max_length: 600,
            overlap_length: 30,
          },
        },
      },
      summary_index_setting: {
        enable: true,
        model_name: 'doubao-summary',
        model_provider_name: 'ark',
        summary_prompt: '请总结文档。',
      },
      doc_form: 'text_model',
      doc_language: 'Chinese Simplified',
    });

    expect(created.id).toContain('售后案例库');
    expect(created.documentCount).toBe(0);
    expect(created.embedding_model).toBe('doubao-embedding');
    expect(created.retrieval_model.search_method).toBe('hybrid_search');
    expect(created.process_rule.rules.segmentation.segment_max_length).toBe(1200);

    const updated = await updateKnowledgeDataset(created.id, {
      name: '售后案例知识库',
      description: '更新后的说明',
      is_multimodal: true,
      doc_metadata: [{ key: 'priority', label: '优先级' }],
      indexing_technique: 'economy',
      embedding_model: 'fallback-embedding',
      embedding_model_provider: 'local',
      retrieval_model: {
        search_method: 'semantic_search',
        top_k: 3,
        score_threshold_enabled: false,
        score_threshold: null,
        reranking_enable: false,
        reranking_mode: 'weighted_score',
        weights: {
          semantic: 1,
          keyword: 0,
          full_text: 0,
        },
      },
      process_rule: {
        mode: 'automatic',
        rules: {
          pre_processing_rules: [],
          segmentation: {
            separator: '\n',
            max_tokens: 256,
            chunk_overlap: 20,
          },
          parent_mode: 'full-doc',
          subchunk_segmentation: {
            separator: '\n',
            max_tokens: 128,
            chunk_overlap: 10,
          },
        },
      },
      summary_index_setting: {
        enable: false,
      },
      doc_form: 'hierarchical_model',
      doc_language: 'English',
    });

    expect(updated.name).toBe('售后案例知识库');
    expect(updated.is_multimodal).toBe(true);
    expect(updated.doc_metadata).toEqual([{ key: 'priority', label: '优先级' }]);
    expect(updated.indexing_technique).toBe('economy');
    expect(updated.embedding_model).toBe('fallback-embedding');
    expect(updated.retrieval_model.search_method).toBe('semantic_search');
    expect(updated.doc_form).toBe('hierarchical_model');
    expect(updated.doc_language).toBe('English');

    await deleteKnowledgeDataset(created.id);

    const items = await listKnowledgeDatasets();
    expect(items.some((item) => item.id === created.id)).toBe(false);

    const persisted = JSON.parse(await readFile(storeFilePath, 'utf-8')) as Array<{ id: string }>;
    expect(persisted.some((item) => item.id === created.id)).toBe(false);
  });

  it('should hydrate missing advanced config with defaults from persisted legacy data', async () => {
    const legacy = [
      {
        id: 'legacy-dataset',
        name: '旧知识库',
        description: 'legacy',
        is_multimodal: false,
        doc_metadata: [],
        documentCount: 0,
        chunkCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    await writeFile(storeFilePath, JSON.stringify(legacy), 'utf-8');

    await initKnowledgeDatasetStore();
    const items = await listKnowledgeDatasets();

    expect(items[0]?.indexing_technique).toBe('high_quality');
    expect(items[0]?.embedding_model).toBe('default-embedding');
    expect(items[0]?.retrieval_model.search_method).toBe('semantic_search');
    expect(items[0]?.process_rule.mode).toBe('custom');
    expect(items[0]?.doc_form).toBe('text_model');
  });
});