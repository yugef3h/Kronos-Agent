import type { ValueSelector } from '../llm-panel/types'

export type {
  KnowledgeDatasetDetail,
  KnowledgeMetadataField,
} from '../../../../knowledge/types'

export type KnowledgeRetrievalMode = 'oneWay' | 'multiWay'

export type KnowledgeRetrievalModelConfig = {
  model: string
  top_k: number
  score_threshold: number | null
}

export type KnowledgeMultiRetrievalConfig = {
  top_k: number
  score_threshold: number | null
  reranking_enable: boolean
  reranking_model: string
}

export type KnowledgeRetrievalNodeConfig = {
  query_variable_selector: ValueSelector
  query_attachment_selector: ValueSelector
  dataset_ids: string[]
  retrieval_mode: KnowledgeRetrievalMode
  single_retrieval_config: KnowledgeRetrievalModelConfig
  multiple_retrieval_config: KnowledgeMultiRetrievalConfig
}

export type KnowledgeValidationIssue = {
  path: string
  message: string
}

export type KnowledgeRetrievalDebugRun = {
  requestedAt: number
  query: string
  items: Array<{
    dataset_id: string
    dataset_name: string
    document_id: string
    document_name: string
    chunk_id: string
    chunk_index: number
    text: string
    score: number
    search_method: 'semantic_search' | 'full_text_search' | 'keyword_search' | 'hybrid_search'
    matched_terms: string[]
    metadata: Record<string, string>
    token_count: number
    char_count: number
  }>
  diagnostics: {
    retrieval_mode: 'oneWay' | 'multiWay'
    dataset_count: number
    total_chunk_count: number
    filtered_chunk_count: number
  }
}
