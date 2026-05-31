export type KnowledgeDatasetResponseField = {
	key: string;
	label: string;
};

export type KnowledgeSegmentationRule = {
	separator: string;
	max_tokens: number;
	chunk_overlap: number;
	segment_max_length?: number;
	overlap_length?: number;
};

export type KnowledgePreProcessingRule = {
	id: string;
	enabled: boolean;
};

export type KnowledgeProcessRule = {
	mode: 'custom' | 'hierarchical' | 'automatic';
	rules: {
		pre_processing_rules: KnowledgePreProcessingRule[];
		segmentation: KnowledgeSegmentationRule;
		parent_mode: 'full-doc' | 'paragraph';
		subchunk_segmentation: KnowledgeSegmentationRule;
	};
};

export type KnowledgeRetrievalWeights = {
	semantic: number;
	keyword: number;
	full_text: number;
};

export type KnowledgeRetrievalModel = {
	search_method: 'semantic_search' | 'full_text_search' | 'keyword_search' | 'hybrid_search';
	top_k: number;
	score_threshold_enabled: boolean;
	score_threshold: number | null;
	reranking_enable: boolean;
	reranking_model?: string;
	reranking_mode: 'weighted_score' | 'model_rerank';
	weights: KnowledgeRetrievalWeights;
};

export type KnowledgeSummaryIndexSetting = {
	enable: boolean;
	model_name?: string;
	model_provider_name?: string;
	summary_prompt?: string;
};

export type KnowledgeDatasetResponseItem = {
	id: string;
	name: string;
	description: string;
	is_multimodal: boolean;
	doc_metadata: KnowledgeDatasetResponseField[];
	indexing_technique: 'economy' | 'high_quality';
	embedding_model: string;
	embedding_model_provider: string;
	retrieval_model: KnowledgeRetrievalModel;
	process_rule: KnowledgeProcessRule;
	summary_index_setting: KnowledgeSummaryIndexSetting;
	doc_form: 'text_model' | 'qa_model' | 'hierarchical_model';
	doc_language: string;
	documentCount?: number;
	chunkCount?: number;
	documentExtensions?: string[];
	createdAt?: number;
	updatedAt?: number;
};

export type KnowledgeDatasetsResponse = {
	items: KnowledgeDatasetResponseItem[];
};

export type KnowledgeDatasetMutationInput = {
	name: string;
	description: string;
	is_multimodal: boolean;
	doc_metadata: KnowledgeDatasetResponseField[];
	indexing_technique?: 'economy' | 'high_quality';
	embedding_model?: string;
	embedding_model_provider?: string;
	retrieval_model?: KnowledgeRetrievalModel;
	process_rule?: KnowledgeProcessRule;
	summary_index_setting?: KnowledgeSummaryIndexSetting;
	doc_form?: 'text_model' | 'qa_model' | 'hierarchical_model';
	doc_language?: string;
};

export type KnowledgeDocumentResponseItem = {
	id: string;
	datasetId: string;
	name: string;
	extension: string;
	mimeType: string;
	size: number;
	status: 'completed';
	createdAt: number;
	updatedAt: number;
	chunkCount: number;
	characterCount: number;
	previewText: string;
	metadata: Record<string, string>;
	contentHash?: string;
	sourcePath: string;
	parsedTextPath: string;
	chunkPath: string;
};

export type KnowledgeDocumentChunkPreview = {
	id: string;
	index: number;
	text: string;
	tokenCount: number;
	charCount: number;
	metadata?: Record<string, string>;
	keywords?: string[];
};

export type KnowledgeDocumentsResponse = {
	items: KnowledgeDocumentResponseItem[];
};

export type KnowledgeDocumentBlocksResponse = {
	document: KnowledgeDocumentResponseItem;
	chunks: KnowledgeDocumentChunkPreview[];
};

export type KnowledgeDocumentImportResponse = {
	document: KnowledgeDocumentResponseItem;
	preview: KnowledgeDocumentChunkPreview[];
};

export type KnowledgeDocumentBlockKeywordUpdateResponse = {
	document: KnowledgeDocumentResponseItem;
	chunk: KnowledgeDocumentChunkPreview;
};

export type KnowledgeDocumentPreviewItem = {
	fileName: string;
	mimeType: string;
	totalChunks: number;
	preview: KnowledgeDocumentChunkPreview[];
};

export type KnowledgeDocumentPreviewResponse = {
	items: KnowledgeDocumentPreviewItem[];
};

export type KnowledgeRetrievalQueryInput = {
	query: string;
	dataset_ids: string[];
	retrieval_mode: 'oneWay' | 'multiWay';
	single_retrieval_config: {
		model: string;
		top_k: number;
		score_threshold: number | null;
	};
	multiple_retrieval_config: {
		top_k: number;
		score_threshold: number | null;
		reranking_enable: boolean;
		reranking_model?: string;
	};
	metadata_filtering_mode: 'disabled' | 'manual';
	metadata_filtering_conditions: Array<{
		id?: string;
		field: string;
		operator: 'contains' | 'equals' | 'not_equals';
		value: string;
	}>;
};

export type KnowledgeRetrievalQueryResponse = {
	query: string;
	items: Array<{
		dataset_id: string;
		dataset_name: string;
		document_id: string;
		document_name: string;
		chunk_id: string;
		chunk_index: number;
		text: string;
		score: number;
		search_method: 'semantic_search' | 'full_text_search' | 'keyword_search' | 'hybrid_search';
		matched_terms: string[];
		metadata: Record<string, string>;
		token_count: number;
		char_count: number;
	}>;
	diagnostics: {
		retrieval_mode: 'oneWay' | 'multiWay';
		dataset_count: number;
		total_chunk_count: number;
		filtered_chunk_count: number;
		query_variants?: number;
	};
};

export type KnowledgeDatasetHealthReport = {
	datasetId: string;
	documentCount: number;
	chunkCount: number;
	emptyDocuments: number;
	exactDuplicateChunkCount: number;
	nearRedundantChunkPairCount: number;
	tinyChunkRatio: number;
	medianChunkChars: number;
	p90ChunkChars: number;
	healthScore: number;
	hints: string[];
};

export type KnowledgeDatasetSnapshotSummary = {
	id: string;
	datasetId: string;
	createdAt: number;
	documentCount: number;
	chunkCount: number;
	sizeBytes: number;
};

export type KnowledgeRetrievalCompareInput = {
	retrieval_a: KnowledgeRetrievalQueryInput;
	retrieval_b: KnowledgeRetrievalQueryInput;
};

export type KnowledgeRetrievalCompareResponse = {
	query: string;
	dataset_ids: string[];
	a: { latencyMs: number; result: KnowledgeRetrievalQueryResponse };
	b: { latencyMs: number; result: KnowledgeRetrievalQueryResponse };
	overlapTopK: { chunkIdsInBoth: number; jaccardChunkIds: number };
};

export type KnowledgeRetrievalEvalSharedInput = Omit<KnowledgeRetrievalQueryInput, 'query'>;

export type KnowledgeRetrievalEvalCaseInput = {
	query: string;
	gold_chunk_ids?: string[];
	expected_answer?: string;
	generated_answer?: string;
};

export type KnowledgeRetrievalEvalInput = {
	shared: KnowledgeRetrievalEvalSharedInput;
	cases: KnowledgeRetrievalEvalCaseInput[];
};

export type KnowledgeRetrievalEvalCaseResult = {
	query: string;
	recall_at_k: number | null;
	mrr: number | null;
	em: number | null;
	f1: number | null;
	hallucination_char_miss_rate: number | null;
	top_chunk_ids: string[];
};

export type KnowledgeRetrievalEvalSummary = {
	sample_count: number;
	recall_at_k: number | null;
	mrr: number | null;
	em: number | null;
	f1: number | null;
	hallucination_char_miss_rate: number | null;
};

export type KnowledgeRetrievalEvalResponse = {
	cases: KnowledgeRetrievalEvalCaseResult[];
	summary: KnowledgeRetrievalEvalSummary;
};

export type DatasetIndexingEstimateResponse = {
	total_nodes: number;
	tokens: number;
	total_price: number;
	currency: string;
	total_segments: number;
	preview: Array<{
		content: string;
		child_chunks: string[];
		summary?: string;
	}>;
	qa_preview?: Array<{
		question: string;
		answer: string;
	}>;
};
