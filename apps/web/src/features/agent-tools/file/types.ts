export const FILE_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const FILE_SUPPORTED_MIME_TYPES = [
  'application/json',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/markdown',
  'text/plain',
] as const;

export const FILE_SUPPORTED_EXTENSIONS = ['csv', 'docx', 'json', 'md', 'pdf', 'txt'] as const;

export type SupportedFileMimeType = (typeof FILE_SUPPORTED_MIME_TYPES)[number];
export type SupportedFileExtension = (typeof FILE_SUPPORTED_EXTENSIONS)[number];

export type FileSelectionResult = {
  fileName: string;
  mimeType: SupportedFileMimeType;
  size: number;
  extension: SupportedFileExtension;
  dataUrl: string;
};