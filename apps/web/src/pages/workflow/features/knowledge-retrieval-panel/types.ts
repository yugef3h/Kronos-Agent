import type { ValueSelector } from '../llm-panel/types'

export type KnowledgeRetrievalMode = 'oneWay' | 'multiWay'
export type KnowledgeMetadataFilteringMode = 'disabled' | 'manual'
export type KnowledgeMetadataOperator = 'contains' | 'equals' | 'not_equals'

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
  documentCount?: number
  createdAt?: number
  updatedAt?: number
}

export type KnowledgeMetadataCondition = {
  id: string
  field: string
  operator: KnowledgeMetadataOperator
  value: string
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
  metadata_filtering_mode: KnowledgeMetadataFilteringMode
  metadata_filtering_conditions: KnowledgeMetadataCondition[]
}

export type KnowledgeValidationIssue = {
  path: string
  message: string
}