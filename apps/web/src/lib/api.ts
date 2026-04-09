const readViteApiBaseUrl = (): string | undefined => {
	try {
		return Function('return import.meta?.env?.VITE_API_BASE_URL')() as string | undefined;
	} catch {
		return undefined;
	}
};

const API_BASE_URL = readViteApiBaseUrl() || 'http://localhost:3001';

export const apiUrl = (path: string): string => `${API_BASE_URL}${path}`;

const readApiErrorMessage = async (response: Response, fallback: string) => {
	try {
		const contentType = response.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			const payload = await response.json() as { error?: unknown };
			if (typeof payload.error === 'string' && payload.error.trim()) {
				return payload.error.trim();
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

export type DevTokenResponse = {
	token: string;
	tokenType: 'Bearer';
	expiresIn: string;
};

export type SessionSnapshotResponse = {
	messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: number; attachments?: { id: string; type: 'image'; fileName: string; mimeType: string; size: number; createdAt: number }[] }>;
	memorySummary: string;
	memorySummaryUpdatedAt: number | null;
	lastId: number;
	memoryMetrics: {
		messageCount: number;
		conversationTokensEstimate: number;
		summaryTokensEstimate: number;
		budgetTokensEstimate: number;
		summaryTriggerMessageCount: number;
		isSummaryThresholdReached: boolean;
	};
};

export type RecentDialogueItem = {
	id: string;
	sessionId: string;
	updatedAt: number;
	userContent: string;
};

export type RecentSessionResponse = {
	items: RecentDialogueItem[];
};

export type HotTopicsResponse = {
	topics: string[];
	source: 'model' | 'fallback';
};

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
	action: 'chat' | 'ask_slot' | 'tool_call';
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

export type SessionAppendMessage = {
	role: 'user' | 'assistant';
	content: string;
};

export type KnowledgeDatasetResponseField = {
	key: string;
	label: string;
};

export type KnowledgeDatasetResponseItem = {
	id: string;
	name: string;
	description: string;
	is_multimodal: boolean;
	doc_metadata: KnowledgeDatasetResponseField[];
	documentCount?: number;
	chunkCount?: number;
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

export type KnowledgeDocumentPreviewItem = {
	fileName: string;
	mimeType: string;
	totalChunks: number;
	preview: KnowledgeDocumentChunkPreview[];
};

export type KnowledgeDocumentPreviewResponse = {
	items: KnowledgeDocumentPreviewItem[];
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

	return (await response.json()) as RecentSessionResponse;
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
	const response = await fetch(apiUrl(`/api/workflow/knowledge-datasets/${params.datasetId}`), {
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
	const response = await fetch(apiUrl(`/api/workflow/knowledge-datasets/${params.datasetId}`), {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (!response.ok) {
		throw new Error('Failed to delete knowledge dataset');
	}
};

export const requestKnowledgeDocuments = async (params: {
	authToken: string;
	datasetId: string;
}): Promise<KnowledgeDocumentsResponse> => {
	const response = await fetch(apiUrl(`/api/workflow/knowledge-datasets/${params.datasetId}/documents`), {
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
	const response = await fetch(apiUrl(`/api/workflow/knowledge-datasets/${params.datasetId}/documents/${params.documentId}/blocks`), {
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
	};
}): Promise<KnowledgeDocumentImportResponse> => {
	const response = await fetch(apiUrl(`/api/workflow/knowledge-datasets/${params.datasetId}/documents/import`), {
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
