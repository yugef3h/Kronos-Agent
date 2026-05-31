import type { KnowledgeDatasetRecord } from '../../models/knowledgeDatasetStore.js';
import type { KnowledgeDocumentPreprocessingRules } from './knowledgeChunkingService.js';

export const DEFAULT_IMPORT_PREPROCESSING_RULES: KnowledgeDocumentPreprocessingRules = {
  normalizeWhitespace: true,
  removeUrlsEmails: false,
};

const rulesFromDataset = (
  dataset: KnowledgeDatasetRecord,
): KnowledgeDocumentPreprocessingRules => {
  const enabledRuleIds = new Set(
    (dataset.process_rule?.rules?.pre_processing_rules ?? [])
      .filter((rule) => rule.enabled)
      .map((rule) => rule.id),
  );

  return {
    normalizeWhitespace: enabledRuleIds.has('remove_extra_spaces'),
    removeUrlsEmails: enabledRuleIds.has('remove_urls_emails'),
  };
};

/** 入库预处理：请求体优先，缺省对齐知识库 process_rule（与 Dify 分段配置一致） */
export const resolveImportPreprocessingRules = (
  dataset: KnowledgeDatasetRecord,
  input?: KnowledgeDocumentPreprocessingRules,
): KnowledgeDocumentPreprocessingRules => {
  const fromDataset = rulesFromDataset(dataset);

  return {
    normalizeWhitespace: input?.normalizeWhitespace ?? fromDataset.normalizeWhitespace,
    removeUrlsEmails: input?.removeUrlsEmails ?? fromDataset.removeUrlsEmails,
  };
};
