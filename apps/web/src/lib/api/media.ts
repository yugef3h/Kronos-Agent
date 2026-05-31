import { apiUrl } from './core';
import type { ImageHostUploadResponse, ImageRecognitionResponse, FileAnalysisResponse, TokenEmbeddingAnalyzeResponse } from './types/media';

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
