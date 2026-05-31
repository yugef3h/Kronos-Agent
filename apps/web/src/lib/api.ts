export { apiUrl, knowledgeDatasetApiPath, readApiErrorMessage, extractStructuredApiErrorMessage } from './api/core';
export type { ApiErrorPayload } from './api/core';
import { apiUrl, knowledgeDatasetApiPath, readApiErrorMessage } from './api/core';

export type { DevTokenResponse, SessionSnapshotResponse, PlaygroundHistorySurface, RecentDialogueItem, RecentSessionResponse, HotTopicsResponse };
export { tryParsePublishedPlaygroundStreamSessionId, normalizeRecentDialogueItemDto };
import type { DevTokenResponse, SessionSnapshotResponse, PlaygroundHistorySurface, RecentDialogueItem, RecentDialogueItemDto, RecentSessionResponse, HotTopicsResponse } from './api/types/session';
import { tryParsePublishedPlaygroundStreamSessionId, normalizeRecentDialogueItemDto } from './api/types/session';

export type { TakeoutInstruction, TakeoutSimulationPayload, TakeoutSimulationResponse, TakeoutIntentAnalysisResponse, TakeoutOrchestrationResponse, TakeoutCatalogComboResponse, TakeoutCatalogFoodResponse, TakeoutCatalogResponse };
import type { TakeoutInstruction, TakeoutSimulationPayload, TakeoutSimulationResponse, TakeoutIntentAnalysisResponse, TakeoutOrchestrationResponse, TakeoutCatalogComboResponse, TakeoutCatalogFoodResponse, TakeoutCatalogResponse } from './api/types/takeout';

export type { ImageHostUploadResponse, ImageRecognitionResponse, FileAnalysisResponse, TokenEmbeddingAnalyzeResponse };
import type { ImageHostUploadResponse, ImageRecognitionResponse, FileAnalysisResponse, TokenEmbeddingAnalyzeResponse } from './api/types/media';

export type { SessionAppendMessage };
import type { SessionAppendMessage } from './api/types/session';

export type { KnowledgeDatasetResponseField, KnowledgeSegmentationRule, KnowledgePreProcessingRule, KnowledgeProcessRule, KnowledgeRetrievalWeights, KnowledgeRetrievalModel, KnowledgeSummaryIndexSetting, KnowledgeDatasetResponseItem, KnowledgeDatasetsResponse, KnowledgeDatasetMutationInput, KnowledgeDocumentResponseItem, KnowledgeDocumentChunkPreview, KnowledgeDocumentsResponse, KnowledgeDocumentBlocksResponse, KnowledgeDocumentImportResponse, KnowledgeDocumentBlockKeywordUpdateResponse, KnowledgeDocumentPreviewItem, KnowledgeDocumentPreviewResponse, KnowledgeRetrievalQueryInput, KnowledgeRetrievalQueryResponse, KnowledgeDatasetHealthReport, KnowledgeDatasetSnapshotSummary, KnowledgeRetrievalCompareInput, KnowledgeRetrievalCompareResponse, KnowledgeRetrievalEvalSharedInput, KnowledgeRetrievalEvalCaseInput, KnowledgeRetrievalEvalInput, KnowledgeRetrievalEvalCaseResult, KnowledgeRetrievalEvalSummary, KnowledgeRetrievalEvalResponse, DatasetIndexingEstimateResponse };
import type { KnowledgeDatasetResponseField, KnowledgeSegmentationRule, KnowledgePreProcessingRule, KnowledgeProcessRule, KnowledgeRetrievalWeights, KnowledgeRetrievalModel, KnowledgeSummaryIndexSetting, KnowledgeDatasetResponseItem, KnowledgeDatasetsResponse, KnowledgeDatasetMutationInput, KnowledgeDocumentResponseItem, KnowledgeDocumentChunkPreview, KnowledgeDocumentsResponse, KnowledgeDocumentBlocksResponse, KnowledgeDocumentImportResponse, KnowledgeDocumentBlockKeywordUpdateResponse, KnowledgeDocumentPreviewItem, KnowledgeDocumentPreviewResponse, KnowledgeRetrievalQueryInput, KnowledgeRetrievalQueryResponse, KnowledgeDatasetHealthReport, KnowledgeDatasetSnapshotSummary, KnowledgeRetrievalCompareInput, KnowledgeRetrievalCompareResponse, KnowledgeRetrievalEvalSharedInput, KnowledgeRetrievalEvalCaseInput, KnowledgeRetrievalEvalInput, KnowledgeRetrievalEvalCaseResult, KnowledgeRetrievalEvalSummary, KnowledgeRetrievalEvalResponse, DatasetIndexingEstimateResponse } from './api/types/knowledge';

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
