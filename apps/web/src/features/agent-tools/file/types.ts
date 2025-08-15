export const FILE_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const FILE_SUPPORTED_MIME_TYPES = [
  'application/json',
  'application/msword',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/markdown',
  'text/plain',
] as const;

export const FILE_SUPPORTED_EXTENSIONS = ['csv', 'doc', 'docx', 'json', 'md', 'pdf', 'txt', 'xls', 'xlsx'] as const;

export type SupportedFileMimeType = (typeof FILE_SUPPORTED_MIME_TYPES)[number];
export type SupportedFileExtension = (typeof FILE_SUPPORTED_EXTENSIONS)[number];

export type FileSelectionResult = {
  fileName: string;
  mimeType: SupportedFileMimeType;
  size: number;
  extension: SupportedFileExtension;
  dataUrl: string;
};