/**
 * 知识库 HTTP API 出口；实现见 `lib/api`。
 * 检索响应诊断可含 `query_variants`（`RAG_LC_MULTI_QUERY` 且实际产生多条问句时）。
 */
export {
  requestDatasetIndexingEstimate,
  requestImportKnowledgeDocument,
  requestKnowledgeDatasetHealth,
  requestKnowledgeDatasetSnapshotCreate,
  requestKnowledgeDatasetSnapshots,
  requestKnowledgeDocumentBlocks,
  requestKnowledgeDocuments,
  requestKnowledgeRetrievalCompare,
  requestKnowledgeRetrievalEvaluate,
  requestKnowledgeRetrievalQuery,
  requestUpdateKnowledgeDocumentBlockKeywords,
} from '../../lib/api';
