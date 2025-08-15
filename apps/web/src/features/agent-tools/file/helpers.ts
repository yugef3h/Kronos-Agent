import {
  FILE_MAX_UPLOAD_BYTES,
  FILE_SUPPORTED_EXTENSIONS,
  FILE_SUPPORTED_MIME_TYPES,
  type SupportedFileExtension,
  type SupportedFileMimeType,
} from './types';

export const getFileExtension = (fileName: string): string => {
  const segments = fileName.toLowerCase().split('.');
  return segments.length > 1 ? segments[segments.length - 1] : '';
};

export const isSupportedFileMimeType = (mimeType: string): mimeType is SupportedFileMimeType => {
  return (FILE_SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
};

export const isSupportedFileExtension = (extension: string): extension is SupportedFileExtension => {
  return (FILE_SUPPORTED_EXTENSIONS as readonly string[]).includes(extension);
};

export const isFileSizeAllowed = (size: number): boolean => {
  return size > 0 && size <= FILE_MAX_UPLOAD_BYTES;
};

export const inferSupportedFileMimeType = (
  mimeType: string,
  extension: SupportedFileExtension,
): SupportedFileMimeType => {
  if (isSupportedFileMimeType(mimeType)) {
    return mimeType;
  }

  switch (extension) {
    case 'csv':
      return 'text/csv';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'json':
      return 'application/json';
    case 'md':
      return 'text/markdown';
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'text/plain';
  }
};

export const buildFileAnalyzeUserMessage = (params: {
  fileName: string;
  prompt: string;
}): string => {
  const cleanPrompt = params.prompt.trim();
  if (!cleanPrompt) {
    return `文件解读：${params.fileName}`;
  }

  return `文件解读：${params.fileName}\n补充说明：${cleanPrompt}`;
};

export const FILE_INPUT_ACCEPT = [
  ...FILE_SUPPORTED_MIME_TYPES,
  ...FILE_SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`),
].join(',');