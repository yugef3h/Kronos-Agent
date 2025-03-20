import {
  getCompressedImageDimensions,
  isImageSizeAllowed,
  isSupportedImageMimeType,
} from './helpers';
import {
  IMAGE_COMPRESS_QUALITY,
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

const compressImageDataUrl = async (
  dataUrl: string,
  mimeType: SupportedImageMimeType,
): Promise<{ dataUrl: string; size: number }> => {
  const image = await readImageElement(dataUrl);
  const targetDimensions = getCompressedImageDimensions(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = targetDimensions.width;
  canvas.height = targetDimensions.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('浏览器暂不支持图片压缩，请稍后重试');
  }

  context.drawImage(image, 0, 0, targetDimensions.width, targetDimensions.height);

  const compressedDataUrl = mimeType === 'image/png'
    ? canvas.toDataURL(mimeType)
    : canvas.toDataURL(mimeType, IMAGE_COMPRESS_QUALITY);

  return {
    dataUrl: compressedDataUrl,
    size: getDataUrlByteSize(compressedDataUrl),
  };
};

export const prepareImageForAnalyze = async (file: File): Promise<ImageSelectionResult> => {
  if (!isSupportedImageMimeType(file.type)) {
    throw new Error('仅支持 JPG、PNG、WEBP 图片格式');
  }

  if (!isImageSizeAllowed(file.size)) {
    throw new Error('图片大小需在 5MB 以内');
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const compressedImage = await compressImageDataUrl(originalDataUrl, file.type);

  return {
    fileName: file.name,
    mimeType: file.type,
    size: compressedImage.size,
    dataUrl: compressedImage.dataUrl,
  };
};
