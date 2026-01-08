import type {
  KnowledgeDatasetDetail,
  KnowledgeRetrievalNodeConfig,
  KnowledgeValidationIssue,
} from './types'

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value))
    return []

  return value.filter((item): item is string => typeof item === 'string')
}

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value))
    return value

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export const createDefaultKnowledgeRetrievalNodeConfig = (): KnowledgeRetrievalNodeConfig => ({
  query_variable_selector: ['sys', 'query'],
  query_attachment_selector: [],
  dataset_ids: [],
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
    reranking_model: 'default-rerank',
  },
})

export const getKnowledgeSelectedDatasets = (
  datasetIds: string[],
  datasetCatalog: KnowledgeDatasetDetail[] = [],
): KnowledgeDatasetDetail[] => {
  const idSet = new Set(datasetIds)
  return datasetCatalog.filter(dataset => idSet.has(dataset.id))
}

export const shouldShowKnowledgeAttachmentSelector = (
  datasetIds: string[],
  datasetCatalog: KnowledgeDatasetDetail[] = [],
) => {
  return getKnowledgeSelectedDatasets(datasetIds, datasetCatalog).some(dataset => dataset.is_multimodal)
}

export const syncKnowledgeTopK = (
  config: KnowledgeRetrievalNodeConfig,
  value: number,
): KnowledgeRetrievalNodeConfig => ({
  ...config,
  single_retrieval_config: {
    ...config.single_retrieval_config,
    top_k: value,
  },
  multiple_retrieval_config: {
    ...config.multiple_retrieval_config,
    top_k: value,
  },
})

export const normalizeKnowledgeRetrievalNodeConfig = (value: unknown): KnowledgeRetrievalNodeConfig => {
  const defaults = createDefaultKnowledgeRetrievalNodeConfig()

  if (!value || typeof value !== 'object')
    return defaults

  const raw = value as Record<string, unknown>

  const datasetIds = toStringArray(raw.dataset_ids)

  return {
    query_variable_selector: toStringArray(raw.query_variable_selector),
    query_attachment_selector: toStringArray(raw.query_attachment_selector),
    dataset_ids: datasetIds,
    retrieval_mode: raw.retrieval_mode === 'oneWay' ? 'oneWay' : 'multiWay',
    single_retrieval_config: {
      model: typeof raw.single_retrieval_config === 'object' && raw.single_retrieval_config !== null && typeof (raw.single_retrieval_config as Record<string, unknown>).model === 'string'
        ? (raw.single_retrieval_config as Record<string, string>).model
        : defaults.single_retrieval_config.model,
      top_k: typeof raw.single_retrieval_config === 'object' && raw.single_retrieval_config !== null && typeof (raw.single_retrieval_config as Record<string, unknown>).top_k === 'number'
        ? ((raw.single_retrieval_config as Record<string, number>).top_k)
        : defaults.single_retrieval_config.top_k,
      score_threshold: typeof raw.single_retrieval_config === 'object' && raw.single_retrieval_config !== null
        ? toNumberOrNull((raw.single_retrieval_config as Record<string, unknown>).score_threshold)
        : defaults.single_retrieval_config.score_threshold,
    },
    multiple_retrieval_config: {
      top_k: typeof raw.multiple_retrieval_config === 'object' && raw.multiple_retrieval_config !== null && typeof (raw.multiple_retrieval_config as Record<string, unknown>).top_k === 'number'
        ? ((raw.multiple_retrieval_config as Record<string, number>).top_k)
        : defaults.multiple_retrieval_config.top_k,
      score_threshold: typeof raw.multiple_retrieval_config === 'object' && raw.multiple_retrieval_config !== null
        ? toNumberOrNull((raw.multiple_retrieval_config as Record<string, unknown>).score_threshold)
        : defaults.multiple_retrieval_config.score_threshold,
      reranking_enable: typeof raw.multiple_retrieval_config === 'object' && raw.multiple_retrieval_config !== null
        ? Boolean((raw.multiple_retrieval_config as Record<string, unknown>).reranking_enable)
        : defaults.multiple_retrieval_config.reranking_enable,
      reranking_model: typeof raw.multiple_retrieval_config === 'object' && raw.multiple_retrieval_config !== null && typeof (raw.multiple_retrieval_config as Record<string, unknown>).reranking_model === 'string'
        ? ((raw.multiple_retrieval_config as Record<string, string>).reranking_model)
        : defaults.multiple_retrieval_config.reranking_model,
    },
  }
}

export const validateKnowledgeRetrievalNodeConfig = (
  config: KnowledgeRetrievalNodeConfig,
): KnowledgeValidationIssue[] => {
  const issues: KnowledgeValidationIssue[] = []

  if (!config.query_variable_selector.length) {
    issues.push({
      path: 'query_variable_selector',
      message: '请选择查询变量。',
    })
  }

  if (!config.dataset_ids.length) {
    issues.push({
      path: 'dataset_ids',
      message: '至少选择一个知识库。',
    })
  }

  if (config.retrieval_mode === 'oneWay' && !config.single_retrieval_config.model) {
    issues.push({
      path: 'single_retrieval_config.model',
      message: '单路召回模式下必须选择检索模型。',
    })
  }

  if (config.retrieval_mode === 'multiWay' && config.multiple_retrieval_config.reranking_enable && !config.multiple_retrieval_config.reranking_model) {
    issues.push({
      path: 'multiple_retrieval_config.reranking_model',
      message: '开启 Rerank 后必须选择 Rerank 模型。',
    })
  }

  return issues
}
