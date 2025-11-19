import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createKnowledgeDataset,
  initKnowledgeDatasetStore,
  resetKnowledgeDatasetStoreForTests,
} from '../domain/knowledgeDatasetStore.js';
import {
  importKnowledgeDocument,
  previewKnowledgeDocuments,
} from '../domain/knowledgeDocumentStore.js';
import { runKnowledgeRetrievalQuery } from '../services/knowledgeRetrievalService.js';
import {
  assertKnowledgePreviewItemContract,
  assertKnowledgeRetrievalQueryResultContract,
} from './contract/knowledgeRagApiContract.js';
import * as ragEmbeddings from './langchain/ragEmbeddings.js';
import { runLangchainVectorRetrievalQuery } from './langchain/vectorRetrieval.js';

const toDataUrl = (mimeType: string, value: string) => {
  return `data:${mimeType};base64,${Buffer.from(value, 'utf8').toString('base64')}`;
};

/** Step5：双引擎 HTTP 形状一致；此处自研走 service、LangChain 走 vectorRetrieval（mock 向量），避免 Jest 加载 `knowledgeFacade`→`env` 的 import.meta 链。含 `query_variants` 诊断为可选字段。 */
describe('knowledge RAG API contract (Step5)', () => {
  let tempDir = '';
  let storeFilePath = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kronos-rag-contract-'));
    storeFilePath = join(tempDir, 'knowledge-datasets.json');
    process.env.KNOWLEDGE_DATASETS_STORE_PATH = storeFilePath;
    resetKnowledgeDatasetStoreForTests();
    await initKnowledgeDatasetStore();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    resetKnowledgeDatasetStoreForTests();
    delete process.env.KNOWLEDGE_DATASETS_STORE_PATH;
    delete process.env.KNOWLEDGE_DATASETS_DIR;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('self-hosted retrieval matches retrieval response contract', async () => {
    const dataset = await createKnowledgeDataset({
      name: '契约库',
      description: 'Step5',
      is_multimodal: false,
      doc_metadata: [],
    });

    await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'a.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', 'hello contract world'),
      maxTokens: 80,
      chunkOverlap: 0,
    });

    const result = await runKnowledgeRetrievalQuery({
      query: 'contract',
      dataset_ids: [dataset.id],
      retrieval_mode: 'multiWay',
      single_retrieval_config: {
        model: 'default-vector',
        top_k: 3,
        score_threshold: null,
      },
      multiple_retrieval_config: {
        top_k: 5,
        score_threshold: null,
        reranking_enable: false,
      },
      metadata_filtering_mode: 'disabled',
      metadata_filtering_conditions: [],
    });

    assertKnowledgeRetrievalQueryResultContract(result);
  });

  it('LangChain vector retrieval (mock embeddings) matches same retrieval contract', async () => {
    jest.spyOn(ragEmbeddings, 'createRagEmbeddings').mockReturnValue({
      embedDocuments: jest.fn(async (texts: string[]) =>
        texts.map((text, documentIndex) =>
          Array.from({ length: 12 }, (_, dimensionIndex) =>
            Math.sin((documentIndex + dimensionIndex + text.length) * 0.01),
          ),
        )),
      embedQuery: jest.fn(async () => Array.from({ length: 12 }, (_, dimensionIndex) => Math.cos(dimensionIndex * 0.05))),
    } as unknown as ReturnType<typeof ragEmbeddings.createRagEmbeddings>);

    const dataset = await createKnowledgeDataset({
      name: 'LC 契约库',
      description: 'Step5',
      is_multimodal: false,
      doc_metadata: [],
    });

    await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'b.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', 'vector branch shape test'),
      maxTokens: 80,
      chunkOverlap: 0,
    });

    const result = await runLangchainVectorRetrievalQuery({
      query: 'shape',
      dataset_ids: [dataset.id],
      retrieval_mode: 'multiWay',
      single_retrieval_config: {
        model: 'default-vector',
        top_k: 3,
        score_threshold: null,
      },
      multiple_retrieval_config: {
        top_k: 5,
        score_threshold: null,
        reranking_enable: false,
      },
      metadata_filtering_mode: 'disabled',
      metadata_filtering_conditions: [],
    });

    assertKnowledgeRetrievalQueryResultContract(result);
  });

  it('preview-chunks matches preview item contract', async () => {
    const body = {
      inputs: [
        {
          fileName: 'p.txt',
          fileDataUrl: toDataUrl('text/plain', 'preview line one\npreview line two'),
          mimeType: 'text/plain',
          maxTokens: 120,
          chunkOverlap: 10,
        },
      ],
      previewLimit: 8,
    };

    const result = await previewKnowledgeDocuments(body);
    expect(result.items.length).toBe(1);
    assertKnowledgePreviewItemContract(result.items[0]!);
  });

  it('import returns document and preview arrays', async () => {
    const dataset = await createKnowledgeDataset({
      name: '入库契约',
      description: 'Step5',
      is_multimodal: false,
      doc_metadata: [],
    });

    const out = await importKnowledgeDocument({
      datasetId: dataset.id,
      fileName: 'c.txt',
      mimeType: 'text/plain',
      fileDataUrl: toDataUrl('text/plain', 'import and preview'),
      maxTokens: 100,
      chunkOverlap: 0,
    });

    expect(out.document.chunkCount).toBeGreaterThan(0);
    expect(Array.isArray(out.preview)).toBe(true);
  });
});
