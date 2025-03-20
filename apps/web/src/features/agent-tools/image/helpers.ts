import {
  IMAGE_COMPRESS_MAX_EDGE_PX,
  IMAGE_MAX_UPLOAD_BYTES,
  IMAGE_SUPPORTED_MIME_TYPES,
  type SupportedImageMimeType,
} from './types';

type ImageResizeDimensions = {
  width: number;
  height: number;
};

export const isSupportedImageMimeType = (mimeType: string): mimeType is SupportedImageMimeType => {
  return (IMAGE_SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
};

export const isImageSizeAllowed = (size: number): boolean => {
  return size > 0 && size <= IMAGE_MAX_UPLOAD_BYTES;
};

export const getCompressedImageDimensions = (
  width: number,
  height: number,
): ImageResizeDimensions => {
  if (width <= 0 || height <= 0) {
    throw new Error('图片尺寸无效，请重试');
  }

  const longestEdge = Math.max(width, height);
  if (longestEdge <= IMAGE_COMPRESS_MAX_EDGE_PX) {
    return { width, height };
  }

  const scale = IMAGE_COMPRESS_MAX_EDGE_PX / longestEdge;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
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
