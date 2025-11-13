import {
  getCompressedImageDimensions,
  isSupportedImageMimeType,
} from './helpers';
import {
  IMAGE_COMPRESS_QUALITY,
  IMAGE_MAX_COMPRESSED_OUTPUT_BYTES,
  IMAGE_MAX_SOURCE_BYTES,
  type ImageSelectionResult,
  type SupportedImageMimeType,
} from './types';

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('图片读取失败，请重试'));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error('图片读取失败，请重试'));
    };

    reader.readAsDataURL(file);
  });
};

const readImageElement = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败，请重试'));
    image.src = dataUrl;
  });
};

const getDataUrlByteSize = (dataUrl: string): number => {
  const [, base64 = ''] = dataUrl.split(',', 2);
  const normalizedBase64 = base64.replace(/\s/g, '');
  const padding = normalizedBase64.endsWith('==') ? 2 : normalizedBase64.endsWith('=') ? 1 : 0;

  return Math.max(0, Math.floor((normalizedBase64.length * 3) / 4) - padding);
};

const drawToCanvas = (image: HTMLImageElement, width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('浏览器暂不支持图片压缩，请稍后重试');
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas;
};

const compressImageDataUrl = async (
  dataUrl: string,
  mimeType: SupportedImageMimeType,
  maxEdgePx?: number,
): Promise<{ dataUrl: string; size: number }> => {
  const image = await readImageElement(dataUrl);
  const targetDimensions = getCompressedImageDimensions(
    image.naturalWidth,
    image.naturalHeight,
    maxEdgePx,
  );
  const canvas = drawToCanvas(image, targetDimensions.width, targetDimensions.height);

  const compressedDataUrl = mimeType === 'image/png'
    ? canvas.toDataURL(mimeType)
    : canvas.toDataURL(mimeType, IMAGE_COMPRESS_QUALITY);

  return {
    dataUrl: compressedDataUrl,
    size: getDataUrlByteSize(compressedDataUrl),
  };
};

/** 在首遍缩放压缩后，若仍超传输预算则转 JPEG / 降质量 / 缩边，直到达标或失败。 */
const shrinkUntilUnderBudget = async (params: {
  dataUrl: string;
  size: number;
  mime: SupportedImageMimeType;
}): Promise<{ dataUrl: string; size: number; mimeType: SupportedImageMimeType }> => {
  const budget = IMAGE_MAX_COMPRESSED_OUTPUT_BYTES;
  let { dataUrl, size } = params;

  if (size <= budget) {
    return { dataUrl, size, mimeType: params.mime };
  }

  for (const quality of [0.78, 0.68, 0.58, 0.5, 0.42]) {
    const image = await readImageElement(dataUrl);
    const canvas = drawToCanvas(image, image.naturalWidth, image.naturalHeight);
    const jpegUrl = canvas.toDataURL('image/jpeg', quality);
    const nextSize = getDataUrlByteSize(jpegUrl);
    if (nextSize <= budget) {
      return { dataUrl: jpegUrl, size: nextSize, mimeType: 'image/jpeg' };
    }
    dataUrl = jpegUrl;
    size = nextSize;
  }

  for (const maxEdge of [640, 520, 420, 360, 280]) {
    const scaled = await compressImageDataUrl(dataUrl, 'image/jpeg', maxEdge);
    dataUrl = scaled.dataUrl;
    size = scaled.size;
    if (size <= budget) {
      return { dataUrl, size, mimeType: 'image/jpeg' };
    }

    for (const quality of [0.62, 0.5, 0.42]) {
      const image = await readImageElement(dataUrl);
      const canvas = drawToCanvas(image, image.naturalWidth, image.naturalHeight);
      const jpegUrl = canvas.toDataURL('image/jpeg', quality);
      const nextSize = getDataUrlByteSize(jpegUrl);
      if (nextSize <= budget) {
        return { dataUrl: jpegUrl, size: nextSize, mimeType: 'image/jpeg' };
      }
      dataUrl = jpegUrl;
      size = nextSize;
    }
  }

  throw new Error('图片压缩后仍过大，请裁剪或换用较小图片后再试');
};

/**
 * 读入图片 → 按最长边缩放并压缩 →（必要时）继续压到 `IMAGE_MAX_COMPRESSED_OUTPUT_BYTES` 以内。
 * 原图可大于 5MB，上限见 `IMAGE_MAX_SOURCE_BYTES`。
 */
export const prepareImageForAnalyze = async (file: File): Promise<ImageSelectionResult> => {
  if (!isSupportedImageMimeType(file.type)) {
    throw new Error('仅支持 JPG、PNG、WEBP 图片格式');
  }

  if (file.size > IMAGE_MAX_SOURCE_BYTES) {
    throw new Error(`原图不能超过 ${Math.round(IMAGE_MAX_SOURCE_BYTES / (1024 * 1024))}MB，请先缩小文件再上传`);
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  let compressedImage = await compressImageDataUrl(originalDataUrl, file.type);
  let outMime: SupportedImageMimeType = file.type;

  if (compressedImage.size > IMAGE_MAX_COMPRESSED_OUTPUT_BYTES) {
    const shrunk = await shrinkUntilUnderBudget({
      dataUrl: compressedImage.dataUrl,
      size: compressedImage.size,
      mime: file.type,
    });
    compressedImage = { dataUrl: shrunk.dataUrl, size: shrunk.size };
    outMime = shrunk.mimeType;
  }

  return {
    fileName: file.name,
    mimeType: outMime,
    size: compressedImage.size,
    dataUrl: compressedImage.dataUrl,
  };
};
