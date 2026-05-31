import { isViteDev } from './viteEnv';

const readViteApiBaseUrl = (): string | undefined => {
	try {
		const value = Function('return import.meta?.env?.VITE_API_BASE_URL')() as string | undefined;
		if (typeof value === 'string' && value.trim().length > 0) {
			return value.trim().replace(/\/$/, '');
		}
		return undefined;
	} catch {
		return undefined;
	}
};

const resolveApiBaseUrl = (): string => {
	const configured = readViteApiBaseUrl();
	if (configured) {
		return configured;
	}

	// dev：同源请求走 Vite proxy → 后端，避免硬编码 localhost:3001
	if (isViteDev()) {
		return '';
	}

	return 'http://localhost:3001';
};

const API_BASE_URL = resolveApiBaseUrl();

export const apiUrl = (path: string): string => {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
};

const knowledgeDatasetApiPath = (datasetId: string, suffix = '') =>
	`/api/workflow/knowledge-datasets/${encodeURIComponent(datasetId)}${suffix}`;

type ApiErrorPayload = {
	error?:
		| string
		| {
			code?: unknown;
			message?: unknown;
			formErrors?: unknown;
			fieldErrors?: unknown;
		};
	/** 知识库导入 409 等接口在顶层返回人类可读文案 */
	message?: string;
};

const extractStructuredApiErrorMessage = (payload: ApiErrorPayload) => {
	if (typeof payload.message === 'string' && payload.message.trim()) {
		return payload.message.trim();
	}

	if (typeof payload.error === 'string' && payload.error.trim()) {
		return payload.error.trim();
	}

	if (!payload.error || typeof payload.error !== 'object') {
		return '';
	}

	if (typeof payload.error.message === 'string' && payload.error.message.trim()) {
		return payload.error.message.trim();
	}

	if (Array.isArray(payload.error.formErrors)) {
		const formMessage = payload.error.formErrors.find(
			(item): item is string => typeof item === 'string' && Boolean(item.trim()),
		);
		if (formMessage) {
			return formMessage.trim();
		}
	}

	if (payload.error.fieldErrors && typeof payload.error.fieldErrors === 'object') {
		for (const value of Object.values(payload.error.fieldErrors)) {
			if (!Array.isArray(value)) {
				continue;
			}

			const fieldMessage = value.find(
				(item): item is string => typeof item === 'string' && Boolean(item.trim()),
			);
			if (fieldMessage) {
				return fieldMessage.trim();
			}
		}
	}

	return '';
};

const readApiErrorMessage = async (response: Response, fallback: string) => {
	try {
		const contentType = response.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			const payload = await response.json() as ApiErrorPayload;
			const message = extractStructuredApiErrorMessage(payload);
			if (message) {
				return message;
			}
		}

		const text = await response.text();
		if (text.trim()) {
			return text.trim();
		}
	} catch {
		// noop
	}

	return fallback;
};

export type { DevTokenResponse, SessionSnapshotResponse, PlaygroundHistorySurface, RecentDialogueItem, RecentSessionResponse, HotTopicsResponse };
export { tryParsePublishedPlaygroundStreamSessionId, normalizeRecentDialogueItemDto };
import type { DevTokenResponse, SessionSnapshotResponse, PlaygroundHistorySurface, RecentDialogueItem, RecentDialogueItemDto, RecentSessionResponse, HotTopicsResponse } from './api/types/session';
import { tryParsePublishedPlaygroundStreamSessionId, normalizeRecentDialogueItemDto } from './api/types/session';

export type TakeoutInstruction = '识别外卖意图' | '协议同意回复' | '商品选择完成';

export type TakeoutSimulationPayload = {
	prompt?: string;
	address?: string;
	discount?: number;
};

export type TakeoutSimulationResponse = {
	reply: string;
	source: 'scenario';
	traceId: string;
	intent?: 'takeout_order' | 'takeout_recommend' | 'non_takeout';
	confidence?: number;
	slots?: {
		dishType: string | null;
		addressHint: string | null;
		budgetRange: string | null;
		timeConstraint: string | null;
		tastePreference: string[];
	};
	missingSlots?: Array<'dishType' | 'addressHint' | 'budgetRange' | 'timeConstraint'>;
	nextAction?: 'start_takeout_flow' | 'ask_for_slot' | 'fallback_to_chat';
};

export type TakeoutIntentAnalysisResponse = {
	intent: 'takeout_order' | 'takeout_recommend' | 'non_takeout';
	confidence: number;
	slots: {
		dishType: string | null;
		addressHint: string | null;
		budgetRange: string | null;
		timeConstraint: string | null;
		tastePreference: string[];
	};
	missingSlots: Array<'dishType' | 'addressHint' | 'budgetRange' | 'timeConstraint'>;
	nextAction: 'start_takeout_flow' | 'ask_for_slot' | 'fallback_to_chat';
};

export type TakeoutOrchestrationResponse = {
	action: 'chat' | 'ask_slot' | 'tool_call' | 'delegate_chat_stream';
	assistantReply: string;
	toolCall?: {
		name: 'takeout';
		params: {
			food: string;
		};
	};
};

export type TakeoutCatalogComboResponse = {
	id: string;
	name: string;
	extraPrice: number;
};

export type TakeoutCatalogFoodResponse = {
	id: string;
	shopName: string;
	shopScore: number;
	distance: string;
	productName: string;
	productTip: string;
	productImage: string;
	priceTip: string;
	name: string;
	price: number;
	deliveryTime: string;
	combos: TakeoutCatalogComboResponse[];
};

export type TakeoutCatalogResponse = {
	source: 'model' | 'fallback';
	address: string;
	discount: number;
	delivery: {
		eta: string;
		courier: string;
	};
	foods: TakeoutCatalogFoodResponse[];
};

export type ImageHostUploadResponse = {
	url: string;
};

export type ImageRecognitionResponse = {
	reply: string;
	model: string;
	attachmentId?: string;
};

export type FileAnalysisResponse = {
	reply: string;
	model: string;
	extractedCharacters: number;
};

export type TokenEmbeddingAnalyzeResponse = {
	tokenizer: string;
	embeddingModel: string;
	embeddingSource: 'doubao' | 'fallback';
	projectionMethod: 'random' | 'pca' | 'umap';
	tokenCount: number;
	chunkCount: number;
	tokens: Array<{
		index: number;
		tokenId: number;
		tokenText: string;
		start: number;
		end: number;
	}>;
	attentionAssociation?: {
		mode: 'embedding_similarity';
		tokenLimit: number;
		embeddingSource: 'doubao' | 'fallback' | 'python-service';
		matrix: number[][];
		note: string;
	};
};

export type { SessionAppendMessage };
import type { SessionAppendMessage } from './api/types/session';

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

export const requestDevToken = async (): Promise<DevTokenResponse> => {
	const response = await fetch(apiUrl('/api/dev/token'));

	if (!response.ok) {
		throw new Error('Failed to request dev JWT token');
	}

	return (await response.json()) as DevTokenResponse;
};

export const requestSessionSnapshot = async (params: {
	sessionId: string;
	authToken: string;
}): Promise<SessionSnapshotResponse> => {
	const response = await fetch(apiUrl(`/api/session/${params.sessionId}`), {
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (!response.ok) {
			throw new Error(await readApiErrorMessage(response, 'Failed to request session snapshot'));
	}

	return (await response.json()) as SessionSnapshotResponse;
};

export const requestRecentSessions = async (params: {
	authToken: string;
	limit?: number;
}): Promise<RecentSessionResponse> => {
	const limit = params.limit ?? 10;
	const response = await fetch(apiUrl(`/api/sessions/recent?limit=${limit}`), {
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (!response.ok) {
			throw new Error(await readApiErrorMessage(response, 'Failed to request recent sessions'));
	}

	const payload = (await response.json()) as { items: RecentDialogueItemDto[] };
	return {
		items: payload.items.map(normalizeRecentDialogueItemDto),
	};
};

export const requestHotTopics = async (params: {
	authToken: string;
}): Promise<HotTopicsResponse> => {
	const response = await fetch(apiUrl('/api/hot-topics'), {
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (!response.ok) {
		throw new Error('Failed to request hot topics');
	}

	return (await response.json()) as HotTopicsResponse;
};

export const requestTakeoutSimulation = async (params: {
	authToken: string;
	instruction: TakeoutInstruction;
	payload?: TakeoutSimulationPayload;
}): Promise<TakeoutSimulationResponse> => {
	const response = await fetch(apiUrl('/api/takeout/simulate'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			instruction: params.instruction,
			payload: params.payload || {},
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request takeout simulation');
	}

	return (await response.json()) as TakeoutSimulationResponse;
};

export const requestTakeoutIntentAnalysis = async (params: {
	authToken: string;
	prompt: string;
	history?: string[];
}): Promise<TakeoutIntentAnalysisResponse> => {
	const response = await fetch(apiUrl('/api/takeout/intent-analyze'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			prompt: params.prompt,
			history: params.history || [],
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request takeout intent analysis');
	}

	return (await response.json()) as TakeoutIntentAnalysisResponse;
};

export const requestTakeoutOrchestration = async (params: {
	authToken: string;
	prompt: string;
	history?: string[];
	sessionId?: string;
}): Promise<TakeoutOrchestrationResponse> => {
	const response = await fetch(apiUrl('/api/takeout/orchestrate'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			prompt: params.prompt,
			history: params.history || [],
			sessionId: params.sessionId,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request takeout orchestration');
	}

	return (await response.json()) as TakeoutOrchestrationResponse;
};

export const requestTakeoutCatalog = async (params: {
	authToken: string;
	prompt: string;
	address?: string;
}): Promise<TakeoutCatalogResponse> => {
	const response = await fetch(apiUrl('/api/takeout/catalog'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			prompt: params.prompt,
			address: params.address,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request takeout catalog');
	}

	return (await response.json()) as TakeoutCatalogResponse;
};

export const requestImageHostUpload = async (params: {
	authToken: string;
	imageDataUrl: string;
	fileName?: string;
}): Promise<ImageHostUploadResponse> => {
	const response = await fetch(apiUrl('/api/image/host-upload'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			imageDataUrl: params.imageDataUrl,
			fileName: params.fileName,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to upload image to host');
	}

	return (await response.json()) as ImageHostUploadResponse;
};

export const requestImageRecognition = async (params: {
	authToken: string;
	imageDataUrl: string;
	prompt?: string;
	sessionId?: string;
}): Promise<ImageRecognitionResponse> => {
	const response = await fetch(apiUrl('/api/image/analyze'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			imageDataUrl: params.imageDataUrl,
			prompt: params.prompt || '',
			sessionId: params.sessionId,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request image recognition');
	}

	return (await response.json()) as ImageRecognitionResponse;
};

export const requestFileAnalysis = async (params: {
	authToken: string;
	fileDataUrl: string;
	fileName: string;
	mimeType: string;
	prompt?: string;
	sessionId?: string;
}): Promise<FileAnalysisResponse> => {
	const response = await fetch(apiUrl('/api/file/analyze'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			fileDataUrl: params.fileDataUrl,
			fileName: params.fileName,
			mimeType: params.mimeType,
			prompt: params.prompt || '',
			sessionId: params.sessionId,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request file analysis');
	}

	return (await response.json()) as FileAnalysisResponse;
};

export const requestTokenEmbeddingAnalysis = async (params: {
	authToken: string;
	text: string;
	maxChunkSize?: number;
	projectionMethod?: 'random' | 'pca' | 'umap';
	attentionTokenLimit?: number;
}): Promise<TokenEmbeddingAnalyzeResponse> => {
	const response = await fetch(apiUrl('/api/token-embedding/analyze'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			text: params.text,
			maxChunkSize: params.maxChunkSize ?? 180,
			projectionMethod: params.projectionMethod ?? 'pca',
			attentionTokenLimit: params.attentionTokenLimit ?? 24,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request token embedding analysis');
	}

	return (await response.json()) as TokenEmbeddingAnalyzeResponse;
};

export const requestAppendSessionMessages = async (params: {
	authToken: string;
	sessionId: string;
	messages: SessionAppendMessage[];
}): Promise<void> => {
	const response = await fetch(apiUrl('/api/session/append'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			sessionId: params.sessionId,
			messages: params.messages,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to append session messages');
	}
};

export const requestKnowledgeDatasets = async (params: {
	authToken: string;
}): Promise<KnowledgeDatasetsResponse> => {
	const response = await fetch(apiUrl('/api/workflow/knowledge-datasets'), {
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (!response.ok) {
		throw new Error('Failed to request knowledge datasets');
	}

	return (await response.json()) as KnowledgeDatasetsResponse;
};

export const requestCreateKnowledgeDataset = async (params: {
	authToken: string;
	input: KnowledgeDatasetMutationInput;
}): Promise<{ item: KnowledgeDatasetResponseItem }> => {
	const response = await fetch(apiUrl('/api/workflow/knowledge-datasets'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify(params.input),
	});

	if (!response.ok) {
		throw new Error('Failed to create knowledge dataset');
	}

	return (await response.json()) as { item: KnowledgeDatasetResponseItem };
};

export const requestUpdateKnowledgeDataset = async (params: {
	authToken: string;
	datasetId: string;
	input: KnowledgeDatasetMutationInput;
}): Promise<{ item: KnowledgeDatasetResponseItem }> => {
	const response = await fetch(apiUrl(knowledgeDatasetApiPath(params.datasetId)), {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify(params.input),
	});

	if (!response.ok) {
		throw new Error('Failed to update knowledge dataset');
	}

	return (await response.json()) as { item: KnowledgeDatasetResponseItem };
};

export const requestDeleteKnowledgeDataset = async (params: {
	authToken: string;
	datasetId: string;
}): Promise<void> => {
	const response = await fetch(apiUrl(knowledgeDatasetApiPath(params.datasetId)), {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (response.status === 409) {
		const payload = (await response.json().catch(() => ({}))) as {
			error?: string;
			usages?: Array<{ appId: string; appName: string }>;
		};
		const names = Array.isArray(payload.usages)
			? payload.usages.map((usage) => `「${usage.appName}」`).join('、')
			: '';
		throw new Error(
			names
				? `该知识库正被工作流应用 ${names} 使用，无法删除`
				: '该知识库正被工作流应用使用，无法删除',
		);
	}

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to delete knowledge dataset'));
	}
};

export const requestKnowledgeDocuments = async (params: {
	authToken: string;
	datasetId: string;
}): Promise<KnowledgeDocumentsResponse> => {
	const response = await fetch(apiUrl(knowledgeDatasetApiPath(params.datasetId, '/documents')), {
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to request knowledge documents'));
	}

	return (await response.json()) as KnowledgeDocumentsResponse;
};

export const requestKnowledgeDocumentBlocks = async (params: {
	authToken: string;
	datasetId: string;
	documentId: string;
}): Promise<KnowledgeDocumentBlocksResponse> => {
	const response = await fetch(apiUrl(knowledgeDatasetApiPath(params.datasetId, `/documents/${encodeURIComponent(params.documentId)}/blocks`)), {
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to request knowledge document blocks'));
	}

	return (await response.json()) as KnowledgeDocumentBlocksResponse;
};

export const requestImportKnowledgeDocument = async (params: {
	authToken: string;
	datasetId: string;
	input: {
		fileName: string;
		fileDataUrl: string;
		mimeType?: string;
		maxTokens?: number;
		chunkOverlap?: number;
		separator?: string;
		segmentMaxLength?: number;
		overlapLength?: number;
		preprocessingRules?: {
			normalizeWhitespace?: boolean;
			removeUrlsEmails?: boolean;
		};
		metadata?: Record<string, string>;
	};
}): Promise<KnowledgeDocumentImportResponse> => {
	const response = await fetch(apiUrl(knowledgeDatasetApiPath(params.datasetId, '/documents/import')), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify(params.input),
	});

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to import knowledge document'));
	}

	return (await response.json()) as KnowledgeDocumentImportResponse;
};

export const requestUpdateKnowledgeDocumentBlockKeywords = async (params: {
	authToken: string;
	datasetId: string;
	documentId: string;
	blockId: string;
	keywords: string[];
}): Promise<KnowledgeDocumentBlockKeywordUpdateResponse> => {
	const response = await fetch(apiUrl(knowledgeDatasetApiPath(params.datasetId, `/documents/${encodeURIComponent(params.documentId)}/blocks/${encodeURIComponent(params.blockId)}/keywords`)), {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({ keywords: params.keywords }),
	});

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to update knowledge document block keywords'));
	}

	return (await response.json()) as KnowledgeDocumentBlockKeywordUpdateResponse;
};

export const requestPreviewKnowledgeDocumentChunks = async (params: {
	authToken: string;
	input: {
		inputs: Array<{
			fileName: string;
			fileDataUrl: string;
			mimeType?: string;
			maxTokens?: number;
			chunkOverlap?: number;
			separator?: string;
			segmentMaxLength?: number;
			overlapLength?: number;
			preprocessingRules?: {
				normalizeWhitespace?: boolean;
				removeUrlsEmails?: boolean;
			};
		}>;
		previewLimit?: number;
	};
}): Promise<KnowledgeDocumentPreviewResponse> => {
	const response = await fetch(apiUrl('/api/workflow/knowledge-datasets/preview-chunks'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify(params.input),
	});

	if (!response.ok) {
		throw new Error('Failed to preview knowledge document chunks');
	}

	return (await response.json()) as KnowledgeDocumentPreviewResponse;
};

export const requestKnowledgeRetrievalQuery = async (params: {
	authToken: string;
	input: KnowledgeRetrievalQueryInput;
}): Promise<KnowledgeRetrievalQueryResponse> => {
	const response = await fetch(apiUrl('/api/workflow/knowledge-retrieval/query'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify(params.input),
	});

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to run knowledge retrieval query'));
	}

	return (await response.json()) as KnowledgeRetrievalQueryResponse;
};

export const requestKnowledgeDatasetHealth = async (params: {
	authToken: string;
	datasetId: string;
}): Promise<KnowledgeDatasetHealthReport> => {
	const response = await fetch(
		apiUrl(`/api/workflow/knowledge-datasets/${encodeURIComponent(params.datasetId)}/health`),
		{
			headers: { Authorization: `Bearer ${params.authToken}` },
		},
	);

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to load knowledge dataset health'));
	}

	return (await response.json()) as KnowledgeDatasetHealthReport;
};

export const requestKnowledgeDatasetSnapshotCreate = async (params: {
	authToken: string;
	datasetId: string;
}): Promise<KnowledgeDatasetSnapshotSummary> => {
	const response = await fetch(
		apiUrl(`/api/workflow/knowledge-datasets/${encodeURIComponent(params.datasetId)}/snapshots`),
		{
			method: 'POST',
			headers: { Authorization: `Bearer ${params.authToken}` },
		},
	);

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to create knowledge snapshot'));
	}

	return (await response.json()) as KnowledgeDatasetSnapshotSummary;
};

export const requestKnowledgeDatasetSnapshots = async (params: {
	authToken: string;
	datasetId: string;
}): Promise<{ items: KnowledgeDatasetSnapshotSummary[] }> => {
	const response = await fetch(
		apiUrl(`/api/workflow/knowledge-datasets/${encodeURIComponent(params.datasetId)}/snapshots`),
		{
			headers: { Authorization: `Bearer ${params.authToken}` },
		},
	);

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to list knowledge snapshots'));
	}

	return (await response.json()) as { items: KnowledgeDatasetSnapshotSummary[] };
};

export const requestKnowledgeRetrievalCompare = async (params: {
	authToken: string;
	input: KnowledgeRetrievalCompareInput;
}): Promise<KnowledgeRetrievalCompareResponse> => {
	const response = await fetch(apiUrl('/api/workflow/knowledge-retrieval/compare'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify(params.input),
	});

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to compare knowledge retrieval'));
	}

	return (await response.json()) as KnowledgeRetrievalCompareResponse;
};

export const requestKnowledgeRetrievalEvaluate = async (params: {
	authToken: string;
	input: KnowledgeRetrievalEvalInput;
}): Promise<KnowledgeRetrievalEvalResponse> => {
	const response = await fetch(apiUrl('/api/workflow/knowledge-retrieval/evaluate'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify(params.input),
	});

	if (!response.ok) {
		throw new Error(await readApiErrorMessage(response, 'Failed to evaluate knowledge retrieval'));
	}

	return (await response.json()) as KnowledgeRetrievalEvalResponse;
};

export const requestDatasetIndexingEstimate = async (params: {
	authToken: string;
	input: {
		dataset_id: string;
		doc_form: 'text_model' | 'qa_model' | 'hierarchical_model';
		doc_language: string;
		process_rule: {
			mode: 'custom' | 'hierarchical';
			rules: {
				pre_processing_rules: Array<{
					id: string;
					enabled: boolean;
				}>;
				segmentation: {
					separator: string;
					max_tokens: number;
					chunk_overlap?: number;
						segment_max_length?: number;
						overlap_length?: number;
				};
				parent_mode: 'full-doc' | 'paragraph';
				subchunk_segmentation: {
					separator: string;
					max_tokens: number;
					chunk_overlap?: number;
						segment_max_length?: number;
						overlap_length?: number;
				};
			};
		};
		info_list: {
			data_source_type: 'upload_file';
			file_info_list: {
				files: Array<{
					file_name: string;
					file_data_url: string;
					mime_type?: string;
				}>;
			};
		};
	};
}): Promise<DatasetIndexingEstimateResponse> => {
	const response = await fetch(apiUrl('/api/datasets/indexing-estimate'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify(params.input),
	});

	if (!response.ok) {
			throw new Error(await readApiErrorMessage(response, 'Failed to request dataset indexing estimate'));
	}

	return (await response.json()) as DatasetIndexingEstimateResponse;
};

/** 工作流草稿画布缩略图（磁盘缓存，避免 localStorage 配额） */
export async function putWorkflowDraftPreview(
  appId: string,
  dataUrl: string,
  authToken?: string,
): Promise<{
	ok: boolean;
	status: number;
	errorMessage?: string;
}> {
	try {
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		const token = authToken?.trim();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const response = await fetch(
			apiUrl(`/api/workflow/apps/${encodeURIComponent(appId)}/draft-preview`),
			{
				method: 'PUT',
				headers,
				body: JSON.stringify({ dataUrl }),
			},
		);
		if (response.ok) {
			return { ok: true, status: response.status };
		}

		const errorMessage = await readApiErrorMessage(response, 'Failed to save workflow draft preview');
		return { ok: false, status: response.status, errorMessage };
	} catch (error) {
		return {
			ok: false,
			status: 0,
			errorMessage: error instanceof Error ? error.message : 'Network request failed',
		};
	}
}
