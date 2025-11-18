/**
 * RAG 页面专用 API 出口（知识库 HTTP）；实现见 `lib/api`，便于在 `features/rag` 内集中查找。
 * 检索响应诊断可含 `langchain_query_variants`（`RAG_ENGINE_MODE=langchain` 且 `RAG_LC_MULTI_QUERY` 时）。
 */
export {
  requestDatasetIndexingEstimate,
  requestImportKnowledgeDocument,
  requestKnowledgeDocumentBlocks,
  requestKnowledgeDocuments,
  requestKnowledgeRetrievalQuery,
  requestUpdateKnowledgeDocumentBlockKeywords,
} from '../../lib/api';
