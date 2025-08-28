import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createKnowledgeDataset,
  initKnowledgeDatasetStore,
  resetKnowledgeDatasetStoreForTests,
} from '../domain/knowledgeDatasetStore';
import { listKnowledgeDocuments } from '../domain/knowledgeDocumentStore';
import { runKnowledgeIndexingEstimate } from './knowledgeIndexingEstimateService';

const toDataUrl = (mimeType: string, value: Buffer | string) => {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

describe('knowledgeIndexingEstimateService', () => {
  let tempDir = '';
  let storeFilePath = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kronos-indexing-estimate-'));
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

  it('builds text-model indexing estimates without persisting documents', async () => {
    const dataset = await createKnowledgeDataset({
      name: 'Dry Run Dataset',
      description: 'estimate test',
      is_multimodal: false,
      doc_metadata: [],
    });

    const result = await runKnowledgeIndexingEstimate({
      dataset_id: dataset.id,
      doc_form: 'text_model',
      doc_language: 'Chinese Simplified',
      process_rule: {
        mode: 'custom',
        rules: {
          pre_processing_rules: [
            { id: 'remove_extra_spaces', enabled: true },
            { id: 'remove_urls_emails', enabled: false },
          ],
          segmentation: {
            separator: '\n\n',
            max_tokens: 20,
            chunk_overlap: 4,
          },
          parent_mode: 'paragraph',
          subchunk_segmentation: {
            separator: '\n',
            max_tokens: 10,
            chunk_overlap: 2,
          },
        },
      },
      info_list: {
        data_source_type: 'upload_file',
        file_info_list: {
          files: [{
            file_name: 'guide.txt',
            file_data_url: toDataUrl('text/plain', '第一段内容。\n\n第二段内容。\n\n第三段内容。'),
            mime_type: 'text/plain',
          }],
        },
      },
    });

    expect(result.total_nodes).toBe(1);
    expect(result.total_segments).toBeGreaterThan(0);
    expect(result.preview.length).toBe(result.total_segments);
    expect(result.preview[0]?.child_chunks).toEqual([]);

    const documents = await listKnowledgeDocuments(dataset.id);
    expect(documents).toHaveLength(0);
  });

  it('builds hierarchical indexing estimates with child chunks', async () => {
    const dataset = await createKnowledgeDataset({
      name: 'Hierarchical Dataset',
      description: 'hierarchy estimate test',
      is_multimodal: false,
      doc_metadata: [],
    });

    const result = await runKnowledgeIndexingEstimate({
      dataset_id: dataset.id,
      doc_form: 'hierarchical_model',
      doc_language: 'Chinese Simplified',
      process_rule: {
        mode: 'hierarchical',
        rules: {
          pre_processing_rules: [
            { id: 'remove_extra_spaces', enabled: true },
          ],
          segmentation: {
            separator: '\n\n',
            max_tokens: 32,
            chunk_overlap: 0,
          },
          parent_mode: 'paragraph',
          subchunk_segmentation: {
            separator: '\n',
            max_tokens: 12,
            chunk_overlap: 2,
          },
        },
      },
      info_list: {
        data_source_type: 'upload_file',
        file_info_list: {
          files: [{
            file_name: 'policy.txt',
            file_data_url: toDataUrl('text/plain', '第一章 售后说明\n第一条 七天内支持退货\n第二条 退款通常 1 到 3 个工作日\n\n第二章 配送说明\n第一条 偏远地区配送时效更长\n第二条 如遇天气异常可能延迟'),
            mime_type: 'text/plain',
          }],
        },
      },
    });

    expect(result.total_nodes).toBe(1);
    expect(result.preview.length).toBeGreaterThan(0);
    expect(result.preview.some((item) => item.child_chunks.length > 0)).toBe(true);
    expect(result.total_segments).toBeGreaterThanOrEqual(result.preview.length);
  });

  it('rejects file-id mode before temp upload storage exists', async () => {
    const dataset = await createKnowledgeDataset({
      name: 'Unsupported Mode Dataset',
      description: 'unsupported mode test',
      is_multimodal: false,
      doc_metadata: [],
    });

    await expect(runKnowledgeIndexingEstimate({
      dataset_id: dataset.id,
      doc_form: 'text_model',
      doc_language: 'Chinese Simplified',
      process_rule: {
        mode: 'custom',
        rules: {
          pre_processing_rules: [],
          segmentation: {
            separator: '\n\n',
            max_tokens: 20,
          },
          parent_mode: 'paragraph',
          subchunk_segmentation: {
            separator: '\n',
            max_tokens: 10,
          },
        },
      },
      info_list: {
        data_source_type: 'upload_file',
        file_info_list: {
          file_ids: ['file_001'],
        },
      },
    })).rejects.toThrow('UNSUPPORTED_FILE_REFERENCE_MODE');
  });
});