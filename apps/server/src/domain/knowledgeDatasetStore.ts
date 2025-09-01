import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';

export type KnowledgeMetadataField = {
  key: string;
  label: string;
};

export type KnowledgeSearchMethod = 'semantic_search' | 'full_text_search' | 'keyword_search' | 'hybrid_search';
export type KnowledgeRerankingMode = 'weighted_score' | 'model_rerank';
export type KnowledgeIndexingTechnique = 'economy' | 'high_quality';
export type KnowledgeDocumentForm = 'text_model' | 'qa_model' | 'hierarchical_model';
export type KnowledgeProcessRuleMode = 'custom' | 'hierarchical' | 'automatic';
export type KnowledgeParentMode = 'full-doc' | 'paragraph';

export type KnowledgeSegmentationRule = {
  separator: string;
  max_tokens: number;
  chunk_overlap: number;
  segment_max_length?: number;
  overlap_length?: number;
};

export type KnowledgePreProcessingRule = {
  id: string;
  enabled: boolean;
};

export type KnowledgeProcessRule = {
  mode: KnowledgeProcessRuleMode;
  rules: {
    pre_processing_rules: KnowledgePreProcessingRule[];
    segmentation: KnowledgeSegmentationRule;
    parent_mode: KnowledgeParentMode;
    subchunk_segmentation: KnowledgeSegmentationRule;
  };
};

export type KnowledgeSummaryIndexSetting = {
  enable: boolean;
  model_name?: string;
  model_provider_name?: string;
  summary_prompt?: string;
};

export type KnowledgeRetrievalWeights = {
  semantic: number;
  keyword: number;
  full_text: number;
};

export type KnowledgeRetrievalModel = {
  search_method: KnowledgeSearchMethod;
  top_k: number;
  score_threshold_enabled: boolean;
  score_threshold: number | null;
  reranking_enable: boolean;
  reranking_model?: string;
  reranking_mode: KnowledgeRerankingMode;
  weights: KnowledgeRetrievalWeights;
};

const DEFAULT_PROCESS_RULE: KnowledgeProcessRule = {
  mode: 'custom',
  rules: {
    pre_processing_rules: [
      { id: 'remove_extra_spaces', enabled: true },
      { id: 'remove_urls_emails', enabled: false },
    ],
    segmentation: {
      separator: '\n\n',
      max_tokens: 500,
      chunk_overlap: 80,
      segment_max_length: 1024,
      overlap_length: 50,
    },
    parent_mode: 'paragraph',
    subchunk_segmentation: {
      separator: '\n',
      max_tokens: 200,
      chunk_overlap: 30,
      segment_max_length: 512,
      overlap_length: 25,
    },
  },
};

const DEFAULT_RETRIEVAL_MODEL: KnowledgeRetrievalModel = {
  search_method: 'semantic_search',
  top_k: 5,
  score_threshold_enabled: false,
  score_threshold: null,
  reranking_enable: false,
  reranking_model: undefined,
  reranking_mode: 'weighted_score',
  weights: {
    semantic: 1,
    keyword: 0,
    full_text: 0,
  },
};

const DEFAULT_SUMMARY_INDEX_SETTING: KnowledgeSummaryIndexSetting = {
  enable: false,
};

const cloneSegmentationRule = (rule: KnowledgeSegmentationRule): KnowledgeSegmentationRule => ({ ...rule });

const cloneProcessRule = (rule: KnowledgeProcessRule): KnowledgeProcessRule => ({
  mode: rule.mode,
  rules: {
    pre_processing_rules: rule.rules.pre_processing_rules.map((item) => ({ ...item })),
    segmentation: cloneSegmentationRule(rule.rules.segmentation),
    parent_mode: rule.rules.parent_mode,
    subchunk_segmentation: cloneSegmentationRule(rule.rules.subchunk_segmentation),
  },
});

const cloneSummaryIndexSetting = (setting: KnowledgeSummaryIndexSetting): KnowledgeSummaryIndexSetting => ({ ...setting });

const cloneRetrievalWeights = (weights: KnowledgeRetrievalWeights): KnowledgeRetrievalWeights => ({ ...weights });

const cloneRetrievalModel = (model: KnowledgeRetrievalModel): KnowledgeRetrievalModel => ({
  ...model,
  weights: cloneRetrievalWeights(model.weights),
});

export type KnowledgeDatasetRecord = {
  id: string;
  name: string;
  description: string;
  is_multimodal: boolean;
  doc_metadata: KnowledgeMetadataField[];
  indexing_technique: KnowledgeIndexingTechnique;
  embedding_model: string;
  embedding_model_provider: string;
  retrieval_model: KnowledgeRetrievalModel;
  process_rule: KnowledgeProcessRule;
  summary_index_setting: KnowledgeSummaryIndexSetting;
  doc_form: KnowledgeDocumentForm;
  doc_language: string;
  documentCount: number;
  chunkCount: number;
  createdAt: number;
  updatedAt: number;
};

export type KnowledgeDatasetInput = {
  name: string;
  description: string;
  is_multimodal: boolean;
  doc_metadata: KnowledgeMetadataField[];
  indexing_technique?: KnowledgeIndexingTechnique;
  embedding_model?: string;
  embedding_model_provider?: string;
  retrieval_model?: KnowledgeRetrievalModel;
  process_rule?: KnowledgeProcessRule;
  summary_index_setting?: KnowledgeSummaryIndexSetting;
  doc_form?: KnowledgeDocumentForm;
  doc_language?: string;
};

const resolveDefaultDataFile = () => {
  const cwd = process.cwd();
  const repoScopedFile = join(cwd, 'apps/server/data/knowledge-datasets.json');
  if (existsSync(join(cwd, 'apps/server'))) {
    return repoScopedFile;
  }

  return join(cwd, 'data/knowledge-datasets.json');
};

const DEFAULT_DATA_FILE = resolveDefaultDataFile();

const datasets = new Map<string, KnowledgeDatasetRecord>();

let initialized = false;
let persistQueue = Promise.resolve();

const getDataFilePath = () => {
  return process.env.KNOWLEDGE_DATASETS_STORE_PATH || DEFAULT_DATA_FILE;
};

const cloneDataset = (dataset: KnowledgeDatasetRecord): KnowledgeDatasetRecord => ({
  ...dataset,
  doc_metadata: dataset.doc_metadata.map((field) => ({ ...field })),
  retrieval_model: cloneRetrievalModel(dataset.retrieval_model),
  process_rule: cloneProcessRule(dataset.process_rule),
  summary_index_setting: cloneSummaryIndexSetting(dataset.summary_index_setting),
});

const sortDatasets = (items: KnowledgeDatasetRecord[]) => {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
};

const slugify = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || `dataset-${Date.now().toString(36)}`;
};

const normalizeMetadataField = (field: Partial<KnowledgeMetadataField>, index: number): KnowledgeMetadataField | null => {
  const key = typeof field.key === 'string' ? field.key.trim() : '';
  const label = typeof field.label === 'string' ? field.label.trim() : '';

  if (!key) {
    return null;
  }

  return {
    key,
    label: label || `字段 ${index + 1}`,
  };
};

const normalizeSegmentationRule = (
  value: unknown,
  fallback: KnowledgeSegmentationRule,
): KnowledgeSegmentationRule => {
  if (!value || typeof value !== 'object') {
    return cloneSegmentationRule(fallback);
  }

  const raw = value as Record<string, unknown>;

  return {
    separator: typeof raw.separator === 'string' && raw.separator.trim() ? raw.separator : fallback.separator,
    max_tokens: typeof raw.max_tokens === 'number' && Number.isFinite(raw.max_tokens) ? raw.max_tokens : fallback.max_tokens,
    chunk_overlap: typeof raw.chunk_overlap === 'number' && Number.isFinite(raw.chunk_overlap) ? raw.chunk_overlap : fallback.chunk_overlap,
    segment_max_length: typeof raw.segment_max_length === 'number' && Number.isFinite(raw.segment_max_length)
      ? raw.segment_max_length
      : fallback.segment_max_length,
    overlap_length: typeof raw.overlap_length === 'number' && Number.isFinite(raw.overlap_length)
      ? raw.overlap_length
      : fallback.overlap_length,
  };
};

const normalizeProcessRule = (value: unknown): KnowledgeProcessRule => {
  if (!value || typeof value !== 'object') {
    return cloneProcessRule(DEFAULT_PROCESS_RULE);
  }

  const raw = value as Record<string, unknown>;
  const rawRules = raw.rules && typeof raw.rules === 'object' ? raw.rules as Record<string, unknown> : {};
  const rawPreProcessingRules = Array.isArray(rawRules.pre_processing_rules) ? rawRules.pre_processing_rules : [];

  return {
    mode: raw.mode === 'hierarchical' || raw.mode === 'automatic' ? raw.mode : 'custom',
    rules: {
      pre_processing_rules: rawPreProcessingRules
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const rawItem = item as Record<string, unknown>;
          if (typeof rawItem.id !== 'string' || !rawItem.id.trim()) {
            return null;
          }

          return {
            id: rawItem.id.trim(),
            enabled: Boolean(rawItem.enabled),
          } satisfies KnowledgePreProcessingRule;
        })
        .filter((item): item is KnowledgePreProcessingRule => item !== null),
      segmentation: normalizeSegmentationRule(rawRules.segmentation, DEFAULT_PROCESS_RULE.rules.segmentation),
      parent_mode: rawRules.parent_mode === 'full-doc' ? 'full-doc' : 'paragraph',
      subchunk_segmentation: normalizeSegmentationRule(rawRules.subchunk_segmentation, DEFAULT_PROCESS_RULE.rules.subchunk_segmentation),
    },
  };
};

const normalizeSummaryIndexSetting = (value: unknown): KnowledgeSummaryIndexSetting => {
  if (!value || typeof value !== 'object') {
    return cloneSummaryIndexSetting(DEFAULT_SUMMARY_INDEX_SETTING);
  }

  const raw = value as Record<string, unknown>;

  return {
    enable: Boolean(raw.enable),
    model_name: typeof raw.model_name === 'string' && raw.model_name.trim() ? raw.model_name.trim() : undefined,
    model_provider_name: typeof raw.model_provider_name === 'string' && raw.model_provider_name.trim() ? raw.model_provider_name.trim() : undefined,
    summary_prompt: typeof raw.summary_prompt === 'string' && raw.summary_prompt.trim() ? raw.summary_prompt.trim() : undefined,
  };
};

const normalizeRetrievalModel = (value: unknown): KnowledgeRetrievalModel => {
  if (!value || typeof value !== 'object') {
    return cloneRetrievalModel(DEFAULT_RETRIEVAL_MODEL);
  }

  const raw = value as Record<string, unknown>;
  const rawWeights = raw.weights && typeof raw.weights === 'object' ? raw.weights as Record<string, unknown> : {};

  return {
    search_method: raw.search_method === 'full_text_search'
      || raw.search_method === 'keyword_search'
      || raw.search_method === 'hybrid_search'
      ? raw.search_method
      : 'semantic_search',
    top_k: typeof raw.top_k === 'number' && Number.isFinite(raw.top_k) ? raw.top_k : DEFAULT_RETRIEVAL_MODEL.top_k,
    score_threshold_enabled: Boolean(raw.score_threshold_enabled),
    score_threshold: typeof raw.score_threshold === 'number' && Number.isFinite(raw.score_threshold) ? raw.score_threshold : null,
    reranking_enable: Boolean(raw.reranking_enable),
    reranking_model: typeof raw.reranking_model === 'string' && raw.reranking_model.trim() ? raw.reranking_model.trim() : undefined,
    reranking_mode: raw.reranking_mode === 'model_rerank' ? 'model_rerank' : 'weighted_score',
    weights: {
      semantic: typeof rawWeights.semantic === 'number' && Number.isFinite(rawWeights.semantic) ? rawWeights.semantic : DEFAULT_RETRIEVAL_MODEL.weights.semantic,
      keyword: typeof rawWeights.keyword === 'number' && Number.isFinite(rawWeights.keyword) ? rawWeights.keyword : DEFAULT_RETRIEVAL_MODEL.weights.keyword,
      full_text: typeof rawWeights.full_text === 'number' && Number.isFinite(rawWeights.full_text) ? rawWeights.full_text : DEFAULT_RETRIEVAL_MODEL.weights.full_text,
    },
  };
};

const normalizeDatasetRecord = (value: unknown): KnowledgeDatasetRecord | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') {
    return null;
  }

  const metadata = Array.isArray(raw.doc_metadata)
    ? raw.doc_metadata
        .map((field, index) => normalizeMetadataField(field as Partial<KnowledgeMetadataField>, index))
        .filter((field): field is KnowledgeMetadataField => field !== null)
    : [];

  return {
    id: raw.id,
    name: raw.name.trim(),
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    is_multimodal: Boolean(raw.is_multimodal),
    doc_metadata: metadata,
    indexing_technique: raw.indexing_technique === 'economy' ? 'economy' : 'high_quality',
    embedding_model: typeof raw.embedding_model === 'string' && raw.embedding_model.trim() ? raw.embedding_model.trim() : 'default-embedding',
    embedding_model_provider: typeof raw.embedding_model_provider === 'string' && raw.embedding_model_provider.trim() ? raw.embedding_model_provider.trim() : 'default',
    retrieval_model: normalizeRetrievalModel(raw.retrieval_model),
    process_rule: normalizeProcessRule(raw.process_rule),
    summary_index_setting: normalizeSummaryIndexSetting(raw.summary_index_setting),
    doc_form: raw.doc_form === 'qa_model' || raw.doc_form === 'hierarchical_model' ? raw.doc_form : 'text_model',
    doc_language: typeof raw.doc_language === 'string' && raw.doc_language.trim() ? raw.doc_language.trim() : 'Chinese Simplified',
    documentCount: typeof raw.documentCount === 'number' && Number.isFinite(raw.documentCount)
      ? Math.max(0, Math.floor(raw.documentCount))
      : 0,
    chunkCount: typeof raw.chunkCount === 'number' && Number.isFinite(raw.chunkCount)
      ? Math.max(0, Math.floor(raw.chunkCount))
      : 0,
    createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
      ? raw.createdAt
      : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : Date.now(),
  };
};

const persistDatasets = async () => {
  const filePath = getDataFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(sortDatasets([...datasets.values()])), 'utf-8');
};

const enqueuePersist = async () => {
  persistQueue = persistQueue
    .then(async () => {
      await persistDatasets();
    })
    .catch((error) => {
      console.warn('[knowledgeDatasetStore] persist failed:', error);
    });

  await persistQueue;
};

const ensureInitialized = async () => {
  if (!initialized) {
    await initKnowledgeDatasetStore();
  }
};

export const initKnowledgeDatasetStore = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  const filePath = getDataFilePath();

  try {
    await mkdir(dirname(filePath), { recursive: true });

    let nextDatasets: KnowledgeDatasetRecord[] = [];

    try {
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown[];
      nextDatasets = Array.isArray(parsed)
        ? parsed
            .map((item) => normalizeDatasetRecord(item))
            .filter((item): item is KnowledgeDatasetRecord => item !== null)
        : [];
    } catch {
      nextDatasets = [];
    }

    datasets.clear();
    nextDatasets.forEach((dataset) => datasets.set(dataset.id, dataset));
    initialized = true;

    if (!nextDatasets.length) {
      await persistDatasets();
    }
  } catch (error) {
    console.warn('[knowledgeDatasetStore] init failed:', error);
    datasets.clear();
    initialized = true;
  }
};

export const listKnowledgeDatasets = async (): Promise<KnowledgeDatasetRecord[]> => {
  await ensureInitialized();
  return sortDatasets([...datasets.values()]).map(cloneDataset);
};

export const getKnowledgeDatasetById = async (datasetId: string): Promise<KnowledgeDatasetRecord | null> => {
  await ensureInitialized();
  const dataset = datasets.get(datasetId);
  return dataset ? cloneDataset(dataset) : null;
};

export const createKnowledgeDataset = async (input: KnowledgeDatasetInput): Promise<KnowledgeDatasetRecord> => {
  await ensureInitialized();

  const now = Date.now();
  const baseId = slugify(input.name);
  let nextId = baseId;
  let suffix = 1;

  while (datasets.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }

  const dataset: KnowledgeDatasetRecord = {
    id: nextId,
    name: input.name.trim(),
    description: input.description.trim(),
    is_multimodal: input.is_multimodal,
    doc_metadata: input.doc_metadata.map((field) => ({ ...field })),
    indexing_technique: input.indexing_technique ?? 'high_quality',
    embedding_model: input.embedding_model?.trim() || 'default-embedding',
    embedding_model_provider: input.embedding_model_provider?.trim() || 'default',
    retrieval_model: input.retrieval_model ? cloneRetrievalModel(input.retrieval_model) : cloneRetrievalModel(DEFAULT_RETRIEVAL_MODEL),
    process_rule: input.process_rule ? cloneProcessRule(input.process_rule) : cloneProcessRule(DEFAULT_PROCESS_RULE),
    summary_index_setting: input.summary_index_setting
      ? cloneSummaryIndexSetting(input.summary_index_setting)
      : cloneSummaryIndexSetting(DEFAULT_SUMMARY_INDEX_SETTING),
    doc_form: input.doc_form ?? 'text_model',
    doc_language: input.doc_language?.trim() || 'Chinese Simplified',
    documentCount: 0,
    chunkCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  datasets.set(dataset.id, dataset);
  await enqueuePersist();

  return cloneDataset(dataset);
};

export const updateKnowledgeDataset = async (
  datasetId: string,
  input: KnowledgeDatasetInput,
): Promise<KnowledgeDatasetRecord> => {
  await ensureInitialized();

  const existing = datasets.get(datasetId);
  if (!existing) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const updated: KnowledgeDatasetRecord = {
    ...existing,
    name: input.name.trim(),
    description: input.description.trim(),
    is_multimodal: input.is_multimodal,
    doc_metadata: input.doc_metadata.map((field) => ({ ...field })),
    indexing_technique: input.indexing_technique ?? existing.indexing_technique,
    embedding_model: input.embedding_model?.trim() || existing.embedding_model,
    embedding_model_provider: input.embedding_model_provider?.trim() || existing.embedding_model_provider,
    retrieval_model: input.retrieval_model ? cloneRetrievalModel(input.retrieval_model) : cloneRetrievalModel(existing.retrieval_model),
    process_rule: input.process_rule ? cloneProcessRule(input.process_rule) : cloneProcessRule(existing.process_rule),
    summary_index_setting: input.summary_index_setting
      ? cloneSummaryIndexSetting(input.summary_index_setting)
      : cloneSummaryIndexSetting(existing.summary_index_setting),
    doc_form: input.doc_form ?? existing.doc_form,
    doc_language: input.doc_language?.trim() || existing.doc_language,
    updatedAt: Date.now(),
  };

  datasets.set(datasetId, updated);
  await enqueuePersist();

  return cloneDataset(updated);
};

export const deleteKnowledgeDataset = async (datasetId: string): Promise<void> => {
  await ensureInitialized();

  if (!datasets.has(datasetId)) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  datasets.delete(datasetId);
  await enqueuePersist();
};

export const updateKnowledgeDatasetStats = async (
  datasetId: string,
  stats: { documentCount?: number; chunkCount?: number },
): Promise<KnowledgeDatasetRecord> => {
  await ensureInitialized();

  const existing = datasets.get(datasetId);
  if (!existing) {
    throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
  }

  const updated: KnowledgeDatasetRecord = {
    ...existing,
    documentCount: typeof stats.documentCount === 'number' ? Math.max(0, Math.floor(stats.documentCount)) : existing.documentCount,
    chunkCount: typeof stats.chunkCount === 'number' ? Math.max(0, Math.floor(stats.chunkCount)) : existing.chunkCount,
    updatedAt: Date.now(),
  };

  datasets.set(datasetId, updated);
  await enqueuePersist();
  return cloneDataset(updated);
};

export const resetKnowledgeDatasetStoreForTests = () => {
  datasets.clear();
  initialized = false;
  persistQueue = Promise.resolve();
};