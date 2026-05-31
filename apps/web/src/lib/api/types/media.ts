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
