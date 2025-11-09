import type { KnowledgeRetrievalQueryInput } from '../../../lib/api';
import {
  createDefaultChatbotRecallSettings,
  type WorkflowChatbotOrchestration,
} from '../../../features/workflow/workflowAppStore';
import { createDefaultKnowledgeRetrievalNodeConfig } from '../features/knowledge-retrieval-panel/schema';

export const buildChatbotRetrievalInput = (
  query: string,
  orch: Pick<
    WorkflowChatbotOrchestration,
    'datasetIds' | 'metadataFilterMode' | 'metadataFilterConditions' | 'recallSettings'
  >,
): KnowledgeRetrievalQueryInput => {
  const defaults = createDefaultKnowledgeRetrievalNodeConfig();
  const rs = orch.recallSettings ?? createDefaultChatbotRecallSettings();
  const conditions = (orch.metadataFilterConditions ?? []).filter(
    (row) => row.field.trim().length > 0 && row.value.trim().length > 0,
  );
  return {
    query,
    dataset_ids: orch.datasetIds,
    retrieval_mode: defaults.retrieval_mode,
    single_retrieval_config: {
      ...defaults.single_retrieval_config,
      top_k: rs.topK,
    },
    multiple_retrieval_config: {
      ...defaults.multiple_retrieval_config,
      top_k: rs.topK,
      reranking_enable: rs.rerankingEnabled,
      reranking_model: rs.rerankingModel ?? defaults.multiple_retrieval_config.reranking_model,
    },
    metadata_filtering_mode: orch.metadataFilterMode,
    metadata_filtering_conditions: conditions,
  };
};
