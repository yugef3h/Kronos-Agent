export type PendingImportConfig = {
  files: File[];
  datasetId?: string;
  source: 'file' | 'folder' | 'drop';
  rejectedFiles: Array<{ fileName: string; reason: string }>;
};

export type ImportMetadataFieldDraft = {
  id: string;
  key: string;
  label: string;
  value: string;
};

export type ImportFormState = {
  datasetName: string;
  description: string;
  separator: string;
  segmentMaxLength: string;
  overlapLength: string;
  normalizeWhitespace: boolean;
  removeUrlsEmails: boolean;
  topK: string;
  metadataFields: ImportMetadataFieldDraft[];
};

export type LocalPreviewChunk = {
  id: string;
  index: number;
  text: string;
  tokenCount: number;
  charCount: number;
  fileName: string;
};

export type LocalImportPreview = {
  totalNodes: number;
  tokens: number;
  totalChunks: number;
  previewableFileCount: number;
  skippedFiles: Array<{ fileName: string; reason: string }>;
  chunks: LocalPreviewChunk[];
};

export type DatasetDocumentBlock = {
  id: string;
  index: number;
  text: string;
  tokenCount: number;
  charCount: number;
  metadata: Record<string, string>;
  keywords: string[];
};

export type DatasetDocumentBlocksMap = Record<string, DatasetDocumentBlock[]>;

export type DatasetDocumentDetail = {
  id: string;
  name: string;
  chunkCount: number;
  characterCount: number;
  size: number;
  updatedAt: number;
  previewText: string;
  metadata: Record<string, string>;
};

export type FlattenedDatasetDocumentBlock = DatasetDocumentBlock & {
  documentId: string;
  documentName: string;
};
