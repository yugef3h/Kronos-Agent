export const IMAGE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const IMAGE_SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type SupportedImageMimeType = (typeof IMAGE_SUPPORTED_MIME_TYPES)[number];

export type ImageSelectionResult = {
  fileName: string;
  mimeType: SupportedImageMimeType;
  size: number;
  dataUrl: string;
};
