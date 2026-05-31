import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { initKnowledgeDatasetStore, resetKnowledgeDatasetStoreForTests } from '../../../models/knowledgeDatasetStore.js';
import {
  promoteKnowledgeDatasetToExample,
  toExampleRelativeDocumentPath,
} from '../../../workflowExampleKnowledgeSync.js';

describe('workflowExampleKnowledgeSync', () => {
  let tempDir = '';
  let storeFilePath = '';
  let localDatasetsDir = '';
  let examplesDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kronos-wf-knowledge-sync-'));
    storeFilePath = join(tempDir, 'knowledge-datasets.json');
    localDatasetsDir = join(tempDir, 'knowledge-datasets');
    examplesDir = join(tempDir, 'knowledge-examples');

    process.env.KNOWLEDGE_DATASETS_STORE_PATH = storeFilePath;
    process.env.KNOWLEDGE_DATASETS_DIR = localDatasetsDir;
    process.env.KNOWLEDGE_EXAMPLES_DIR = examplesDir;

    resetKnowledgeDatasetStoreForTests();
    await mkdir(localDatasetsDir, { recursive: true });
    await mkdir(examplesDir, { recursive: true });
  });

  afterEach(async () => {
    resetKnowledgeDatasetStoreForTests();
    delete process.env.KNOWLEDGE_DATASETS_STORE_PATH;
    delete process.env.KNOWLEDGE_DATASETS_DIR;
    delete process.env.KNOWLEDGE_EXAMPLES_DIR;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('normalizes absolute document paths to example-relative paths', () => {
    const abs = '/data/knowledge-datasets/demo-set/documents/doc-1/chunks/chunks.jsonl';
    expect(toExampleRelativeDocumentPath('demo-set', abs)).toBe('documents/doc-1/chunks/chunks.jsonl');
    expect(toExampleRelativeDocumentPath('demo-set', 'documents/doc-1/chunks/chunks.jsonl')).toBe(
      'documents/doc-1/chunks/chunks.jsonl',
    );
  });

  it('promotes local dataset into knowledge-examples and removes local shadow', async () => {
    const datasetId = 'promo-demo';
    const now = Date.now();

    await writeFile(
      storeFilePath,
      JSON.stringify([
        {
          id: datasetId,
          name: 'Promo Demo',
          description: 'test',
          is_multimodal: false,
          doc_metadata: [],
          documentCount: 1,
          chunkCount: 2,
          createdAt: now,
          updatedAt: now,
        },
      ]),
      'utf-8',
    );

    const localDatasetDir = join(localDatasetsDir, datasetId);
    const docId = 'doc-promo-1';
    const localDocDir = join(localDatasetDir, 'documents', docId);
    await mkdir(join(localDocDir, 'chunks'), { recursive: true });
    await writeFile(join(localDocDir, 'chunks', 'chunks.jsonl'), '{"id":"c1"}\n', 'utf-8');

    const absChunk = join(localDocDir, 'chunks', 'chunks.jsonl');
    await writeFile(
      join(localDatasetDir, 'documents', 'documents.json'),
      JSON.stringify([
        {
          id: docId,
          datasetId,
          name: 'a.txt',
          chunkCount: 2,
          sourcePath: join(localDocDir, 'source', 'original.txt'),
          parsedTextPath: join(localDocDir, 'parsed', 'content.txt'),
          chunkPath: absChunk,
        },
      ]),
      'utf-8',
    );

    await initKnowledgeDatasetStore();
    await promoteKnowledgeDatasetToExample(datasetId);

    const exampleMeta = JSON.parse(await readFile(join(examplesDir, `${datasetId}.json`), 'utf-8')) as {
      id: string;
      documentCount: number;
    };
    expect(exampleMeta.id).toBe(datasetId);
    expect(exampleMeta.documentCount).toBe(1);

    const exampleIndex = JSON.parse(
      await readFile(join(examplesDir, datasetId, 'documents', 'documents.json'), 'utf-8'),
    ) as Array<{ chunkPath: string }>;
    expect(exampleIndex[0]?.chunkPath).toBe(`documents/${docId}/chunks/chunks.jsonl`);

    const localIndex = JSON.parse(await readFile(storeFilePath, 'utf-8')) as Array<{ id: string }>;
    expect(localIndex.some((row) => row.id === datasetId)).toBe(false);

    await expect(access(join(localDatasetsDir, datasetId))).rejects.toThrow();
  });

  it('does not bump updatedAt when example meta is already in sync', async () => {
    const datasetId = 'stable-example';
    const createdAt = 1_700_000_000_000;
    const updatedAt = 1_700_000_100_000;

    await writeFile(
      join(examplesDir, `${datasetId}.json`),
      JSON.stringify({
        id: datasetId,
        name: 'Stable Example',
        description: 'test',
        is_multimodal: false,
        doc_metadata: [],
        indexing_technique: 'high_quality',
        embedding_model: 'default-embedding',
        embedding_model_provider: 'default',
        retrieval_model: {
          search_method: 'semantic_search',
          top_k: 5,
          score_threshold_enabled: false,
          score_threshold: null,
          reranking_enable: false,
          reranking_mode: 'weighted_score',
          weights: { semantic: 1, keyword: 0, full_text: 0 },
        },
        process_rule: {
          mode: 'custom',
          rules: {
            pre_processing_rules: [],
            segmentation: {
              separator: '\n\n',
              max_tokens: 500,
              chunk_overlap: 80,
            },
            parent_mode: 'paragraph',
            subchunk_segmentation: {
              separator: '\n',
              max_tokens: 200,
              chunk_overlap: 30,
            },
          },
        },
        summary_index_setting: { enable: false },
        doc_form: 'text_model',
        doc_language: 'Chinese Simplified',
        documentCount: 1,
        chunkCount: 2,
        createdAt,
        updatedAt,
      }),
      'utf-8',
    );

    const exampleDatasetDir = join(examplesDir, datasetId);
    const docId = 'doc-stable-1';
    await mkdir(join(exampleDatasetDir, 'documents', docId, 'chunks'), { recursive: true });
    await writeFile(
      join(exampleDatasetDir, 'documents', 'documents.json'),
      JSON.stringify([
        {
          id: docId,
          datasetId,
          name: 'a.txt',
          chunkCount: 2,
          chunkPath: `documents/${docId}/chunks/chunks.jsonl`,
        },
      ]),
      'utf-8',
    );

    await initKnowledgeDatasetStore();
    await promoteKnowledgeDatasetToExample(datasetId);

    const exampleMeta = JSON.parse(await readFile(join(examplesDir, `${datasetId}.json`), 'utf-8')) as {
      updatedAt: number;
    };
    expect(exampleMeta.updatedAt).toBe(updatedAt);
  });
});
