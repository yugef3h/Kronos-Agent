/** 旧逻辑：原始文件 ≤5MB 才处理；仍用于 `isImageSizeAllowed` 等校验命名。 */
export const IMAGE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** 允许读入的原图上限（会先压缩再参与请求）；防止单次把过大文件读进内存。 */
export const IMAGE_MAX_SOURCE_BYTES = 40 * 1024 * 1024;
/** 压缩后 data URL 解码体积上限，避免单图撑爆 JSON / 多模态请求体。 */
export const IMAGE_MAX_COMPRESSED_OUTPUT_BYTES = 3.5 * 1024 * 1024;
export const IMAGE_COMPRESS_MAX_EDGE_PX = 800;
export const IMAGE_COMPRESS_QUALITY = 0.82;

export const IMAGE_SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type SupportedImageMimeType = (typeof IMAGE_SUPPORTED_MIME_TYPES)[number];

export type ImageSelectionResult = {
  fileName: string;
  mimeType: SupportedImageMimeType;
  size: number;
  dataUrl: string;
};
