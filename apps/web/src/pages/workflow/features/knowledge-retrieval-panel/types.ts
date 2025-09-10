import type { ValueSelector } from '../llm-panel/types'

export type KnowledgeRetrievalMode = 'oneWay' | 'multiWay'

export type KnowledgeMetadataField = {
  key: string
  label: string
}

export type KnowledgeDatasetDetail = {
  id: string
  name: string
  description: string
  is_multimodal: boolean
  doc_metadata: KnowledgeMetadataField[]
  indexing_technique?: 'economy' | 'high_quality'
  embedding_model?: string
  embedding_model_provider?: string
  retrieval_model?: {
    search_method: 'semantic_search' | 'full_text_search' | 'keyword_search' | 'hybrid_search'
    top_k: number
    score_threshold_enabled: boolean
    score_threshold: number | null
    reranking_enable: boolean
    reranking_model?: string
    reranking_mode: 'weighted_score' | 'model_rerank'
    weights: {
      semantic: number
      keyword: number
      full_text: number
    }
  }
  process_rule?: {
    mode: 'custom' | 'hierarchical' | 'automatic'
    rules: {
      pre_processing_rules: Array<{ id: string; enabled: boolean }>
      segmentation: {
        separator: string
        max_tokens: number
        chunk_overlap: number
        segment_max_length?: number
        overlap_length?: number
      }
      parent_mode: 'full-doc' | 'paragraph'
      subchunk_segmentation: {
        separator: string
        max_tokens: number
        chunk_overlap: number
        segment_max_length?: number
        overlap_length?: number
      }
    }
  }
  summary_index_setting?: {
    enable: boolean
    model_name?: string
    model_provider_name?: string
    summary_prompt?: string
  }
  doc_form?: 'text_model' | 'qa_model' | 'hierarchical_model'
  doc_language?: string
  documentCount?: number
  chunkCount?: number
  createdAt?: number
  updatedAt?: number
}

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