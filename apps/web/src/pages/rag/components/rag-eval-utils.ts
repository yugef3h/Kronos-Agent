import type {
  KnowledgeRetrievalEvalCaseInput,
  KnowledgeRetrievalEvalSharedInput,
  KnowledgeRetrievalQueryInput,
} from '../../../lib/api/types/knowledge';

export const DEFAULT_EVAL_TOP_K = 5;

export const buildDefaultEvalSharedInput = (datasetIds: string[]): KnowledgeRetrievalEvalSharedInput => ({
  dataset_ids: datasetIds,
  retrieval_mode: 'multiWay',
  single_retrieval_config: {
    model: 'default-vector',
    top_k: 3,
    score_threshold: null,
  },
  multiple_retrieval_config: {
    top_k: DEFAULT_EVAL_TOP_K,
    score_threshold: null,
    reranking_enable: false,
  },
  metadata_filtering_mode: 'disabled',
  metadata_filtering_conditions: [],
});

export const buildDefaultEvalCases = (): KnowledgeRetrievalEvalCaseInput[] => ([
  { query: '这个项目支持哪些能力？' },
]);

export const buildRetrievalQueryInput = (
  shared: KnowledgeRetrievalEvalSharedInput,
  query: string,
): KnowledgeRetrievalQueryInput => ({
  ...shared,
  query,
});

export const parseEvalCasesJson = (raw: string): KnowledgeRetrievalEvalCaseInput[] => {
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('用例 JSON 必须是数组');
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`用例 ${index + 1} 格式无效`);
    }

    const record = item as Record<string, unknown>;
    const query = typeof record.query === 'string' ? record.query.trim() : '';

    if (!query) {
      throw new Error(`用例 ${index + 1} 缺少 query`);
    }

    return {
      query,
      ...(Array.isArray(record.gold_chunk_ids)
        ? { gold_chunk_ids: record.gold_chunk_ids.filter((id): id is string => typeof id === 'string') }
        : {}),
      ...(typeof record.expected_answer === 'string'
        ? { expected_answer: record.expected_answer }
        : {}),
      ...(typeof record.generated_answer === 'string'
        ? { generated_answer: record.generated_answer }
        : {}),
    };
  });
};

export const formatEvalMetric = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }

  return value.toFixed(3);
};
