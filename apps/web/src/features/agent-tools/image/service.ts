import { isImageSizeAllowed, isSupportedImageMimeType } from './helpers';
import type { ImageSelectionResult } from './types';

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

export const prepareImageForAnalyze = async (file: File): Promise<ImageSelectionResult> => {
  if (!isSupportedImageMimeType(file.type)) {
    throw new Error('仅支持 JPG、PNG、WEBP 图片格式');
  }

  if (!isImageSizeAllowed(file.size)) {
    throw new Error('图片大小需在 5MB 以内');
  }

  const dataUrl = await readFileAsDataUrl(file);

  return {
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    dataUrl,
  };
};
