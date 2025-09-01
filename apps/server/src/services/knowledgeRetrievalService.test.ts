import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createKnowledgeDataset,
  initKnowledgeDatasetStore,
  resetKnowledgeDatasetStoreForTests,
  updateKnowledgeDataset,
} from '../domain/knowledgeDatasetStore';
import {
  importKnowledgeDocument,
} from '../domain/knowledgeDocumentStore';
import { runKnowledgeRetrievalQuery } from './knowledgeRetrievalService';

const toDataUrl = (mimeType: string, value: string) => {
  return `data:${mimeType};base64,${Buffer.from(value, 'utf8').toString('base64')}`;
};

describe('knowledgeRetrievalService', () => {
  let tempDir = '';
  let storeFilePath = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kronos-knowledge-retrieval-'));
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

  it('returns the most relevant chunk first for a multi-way retrieval query', async () => {
    const dataset = await createKnowledgeDataset({
      name: '售后知识库',
      description: '检索测试',
      is_multimodal: false,
      doc_metadata: [],
      retrieval_model: {
        search_method: 'hybrid_search',
        top_k: 5,
        score_threshold_enabled: false,
        score_threshold: null,
        reranking_enable: false,
        reranking_mode: 'weighted_score',
        weights: {
          semantic: 0.6,
          keyword: 0.25,
          full_text: 0.15,
        },
      },
    });

    await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'refund.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', '退款多久到账？通常会在 1 到 3 个工作日原路退回。'),
      maxTokens: 40,
      chunkOverlap: 0,
    });
    await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'shipping.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', '配送时间一般是 30 分钟到 1 小时，具体看门店出餐情况。'),
      maxTokens: 40,
      chunkOverlap: 0,
    });

    const result = await runKnowledgeRetrievalQuery({
      query: '退款多久能到账',
      dataset_ids: [dataset.id],
      retrieval_mode: 'multiWay',
      single_retrieval_config: {
        model: 'default-vector',
        top_k: 3,
        score_threshold: null,
      },
      multiple_retrieval_config: {
        top_k: 3,
        score_threshold: null,
        reranking_enable: false,
      },
      metadata_filtering_mode: 'disabled',
      metadata_filtering_conditions: [],
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.document_name).toBe('refund.txt');
    expect(result.items[0]?.matched_terms.length).toBeGreaterThan(0);
    expect(result.diagnostics.total_chunk_count).toBeGreaterThan(0);
  });

  it('respects score threshold for one-way retrieval queries', async () => {
    const dataset = await createKnowledgeDataset({
      name: 'FAQ 知识库',
      description: '阈值测试',
      is_multimodal: false,
      doc_metadata: [],
    });

    await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'faq.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', '联系客服可以处理退款、售后、补发等问题。'),
      maxTokens: 50,
      chunkOverlap: 0,
    });

    const result = await runKnowledgeRetrievalQuery({
      query: '发票邮寄进度',
      dataset_ids: [dataset.id],
      retrieval_mode: 'oneWay',
      single_retrieval_config: {
        model: 'default-vector',
        top_k: 3,
        score_threshold: 0.9,
      },
      multiple_retrieval_config: {
        top_k: 3,
        score_threshold: null,
        reranking_enable: false,
      },
      metadata_filtering_mode: 'disabled',
      metadata_filtering_conditions: [],
    });

    expect(result.items).toEqual([]);
  });

  it('applies metadata filtering conditions before ranking', async () => {
    const dataset = await createKnowledgeDataset({
      name: '工单知识库',
      description: 'metadata 过滤测试',
      is_multimodal: false,
      doc_metadata: [{ key: 'channel', label: '渠道' }],
    });

    await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'ticket.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', '工单渠道为 app，退款由在线客服处理。'),
      maxTokens: 50,
      chunkOverlap: 0,
      metadata: {
        channel: 'app',
      },
    });

    const matched = await runKnowledgeRetrievalQuery({
      query: '退款客服',
      dataset_ids: [dataset.id],
      retrieval_mode: 'multiWay',
      single_retrieval_config: {
        model: 'default-vector',
        top_k: 3,
        score_threshold: null,
      },
      multiple_retrieval_config: {
        top_k: 3,
        score_threshold: null,
        reranking_enable: false,
      },
      metadata_filtering_mode: 'manual',
      metadata_filtering_conditions: [
        {
          field: 'channel',
          operator: 'equals',
          value: 'app',
        },
      ],
    });
    const missed = await runKnowledgeRetrievalQuery({
      query: '退款客服',
      dataset_ids: [dataset.id],
      retrieval_mode: 'multiWay',
      single_retrieval_config: {
        model: 'default-vector',
        top_k: 3,
        score_threshold: null,
      },
      multiple_retrieval_config: {
        top_k: 3,
        score_threshold: null,
        reranking_enable: false,
      },
      metadata_filtering_mode: 'manual',
      metadata_filtering_conditions: [
        {
          field: 'channel',
          operator: 'equals',
          value: 'email',
        },
      ],
    });

    expect(matched.items.length).toBeGreaterThan(0);
    expect(matched.items[0]?.metadata).toEqual({ channel: 'app' });
    expect(missed.items).toEqual([]);
  });

  it('uses reranking to boost an exact phrase match', async () => {
    const dataset = await createKnowledgeDataset({
      name: 'Rerank 知识库',
      description: 'rerank 测试',
      is_multimodal: false,
      doc_metadata: [],
    });

    await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'general.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', '退款问题通常需要结合订单状态和支付方式综合判断。'),
      maxTokens: 50,
      chunkOverlap: 0,
    });
    await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'exact.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', '退款多久到账 一般会在 1 到 3 个工作日内到账。'),
      maxTokens: 50,
      chunkOverlap: 0,
    });

    await updateKnowledgeDataset(dataset.id, {
      name: dataset.name,
      description: dataset.description,
      is_multimodal: dataset.is_multimodal,
      doc_metadata: dataset.doc_metadata,
      retrieval_model: {
        ...dataset.retrieval_model,
        search_method: 'hybrid_search',
      },
    });

    const result = await runKnowledgeRetrievalQuery({
      query: '退款多久到账',
      dataset_ids: [dataset.id],
      retrieval_mode: 'multiWay',
      single_retrieval_config: {
        model: 'default-vector',
        top_k: 3,
        score_threshold: null,
      },
      multiple_retrieval_config: {
        top_k: 3,
        score_threshold: null,
        reranking_enable: true,
        reranking_model: 'default-rerank',
      },
      metadata_filtering_mode: 'disabled',
      metadata_filtering_conditions: [],
    });

    expect(result.items[0]?.document_name).toBe('exact.txt');
  });
});