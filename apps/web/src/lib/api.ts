// Core utilities
export { apiUrl, knowledgeDatasetApiPath, readApiErrorMessage, extractStructuredApiErrorMessage } from './api/core';
export type { ApiErrorPayload } from './api/core';

// Session types & functions
export type { DevTokenResponse, SessionSnapshotResponse, PlaygroundHistorySurface, RecentDialogueItem, RecentSessionResponse, HotTopicsResponse, SessionAppendMessage } from './api/types/session';
export { tryParsePublishedPlaygroundStreamSessionId, normalizeRecentDialogueItemDto } from './api/types/session';
export { requestDevToken, requestSessionSnapshot, requestRecentSessions, requestHotTopics, requestAppendSessionMessages } from './api/session';

// Takeout types & functions
export type { TakeoutInstruction, TakeoutSimulationPayload, TakeoutSimulationResponse, TakeoutIntentAnalysisResponse, TakeoutOrchestrationResponse, TakeoutCatalogComboResponse, TakeoutCatalogFoodResponse, TakeoutCatalogResponse } from './api/types/takeout';
export { requestTakeoutSimulation, requestTakeoutIntentAnalysis, requestTakeoutOrchestration, requestTakeoutCatalog } from './api/takeout';

// Media types & functions
export type { ImageHostUploadResponse, ImageRecognitionResponse, FileAnalysisResponse, TokenEmbeddingAnalyzeResponse } from './api/types/media';
export { requestImageHostUpload, requestImageRecognition, requestFileAnalysis, requestTokenEmbeddingAnalysis } from './api/media';

// Knowledge types & functions
export type { KnowledgeDatasetResponseField, KnowledgeSegmentationRule, KnowledgePreProcessingRule, KnowledgeProcessRule, KnowledgeRetrievalWeights, KnowledgeRetrievalModel, KnowledgeSummaryIndexSetting, KnowledgeDatasetResponseItem, KnowledgeDatasetsResponse, KnowledgeDatasetMutationInput, KnowledgeDocumentResponseItem, KnowledgeDocumentChunkPreview, KnowledgeDocumentsResponse, KnowledgeDocumentBlocksResponse, KnowledgeDocumentImportResponse, KnowledgeDocumentBlockKeywordUpdateResponse, KnowledgeDocumentPreviewItem, KnowledgeDocumentPreviewResponse, KnowledgeRetrievalQueryInput, KnowledgeRetrievalQueryResponse, KnowledgeDatasetHealthReport, KnowledgeDatasetSnapshotSummary, KnowledgeRetrievalCompareInput, KnowledgeRetrievalCompareResponse, KnowledgeRetrievalEvalSharedInput, KnowledgeRetrievalEvalCaseInput, KnowledgeRetrievalEvalInput, KnowledgeRetrievalEvalCaseResult, KnowledgeRetrievalEvalSummary, KnowledgeRetrievalEvalResponse, DatasetIndexingEstimateResponse } from './api/types/knowledge';
export { requestKnowledgeDatasets, requestCreateKnowledgeDataset, requestUpdateKnowledgeDataset, requestDeleteKnowledgeDataset, requestKnowledgeDocuments, requestKnowledgeDocumentBlocks, requestImportKnowledgeDocument, requestUpdateKnowledgeDocumentBlockKeywords, requestPreviewKnowledgeDocumentChunks, requestKnowledgeRetrievalQuery, requestKnowledgeDatasetHealth, requestKnowledgeDatasetSnapshotCreate, requestKnowledgeDatasetSnapshots, requestKnowledgeRetrievalCompare, requestKnowledgeRetrievalEvaluate, requestDatasetIndexingEstimate } from './api/knowledge';

// Workflow functions
export { putWorkflowDraftPreview } from './api/workflow';
