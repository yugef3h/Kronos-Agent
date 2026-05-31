import { apiUrl, knowledgeDatasetApiPath, readApiErrorMessage } from './core';
import type { KnowledgeDatasetsResponse, KnowledgeDatasetMutationInput, KnowledgeDatasetResponseItem, KnowledgeDocumentsResponse, KnowledgeDocumentBlocksResponse, KnowledgeDocumentImportResponse, KnowledgeDocumentBlockKeywordUpdateResponse, KnowledgeDocumentPreviewResponse, KnowledgeRetrievalQueryInput, KnowledgeRetrievalQueryResponse, KnowledgeDatasetHealthReport, KnowledgeDatasetSnapshotSummary, KnowledgeRetrievalCompareInput, KnowledgeRetrievalCompareResponse, KnowledgeRetrievalEvalInput, KnowledgeRetrievalEvalResponse, DatasetIndexingEstimateResponse } from './types/knowledge';

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
