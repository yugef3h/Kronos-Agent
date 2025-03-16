import {
  IMAGE_MAX_UPLOAD_BYTES,
  IMAGE_SUPPORTED_MIME_TYPES,
  type SupportedImageMimeType,
} from './types';

export const isSupportedImageMimeType = (mimeType: string): mimeType is SupportedImageMimeType => {
  return (IMAGE_SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
};

export const isImageSizeAllowed = (size: number): boolean => {
  return size > 0 && size <= IMAGE_MAX_UPLOAD_BYTES;
};

export const buildImageAnalyzeUserMessage = (params: {
  fileName: string;
  prompt: string;
}): string => {
  const cleanPrompt = params.prompt.trim();
  if (!cleanPrompt) {
    return `图片识别：${params.fileName}`;
  }

  return `图片识别：${params.fileName}\n补充说明：${cleanPrompt}`;
};
