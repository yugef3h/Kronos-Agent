import {
  getFileExtension,
  inferSupportedFileMimeType,
  isFileSizeAllowed,
  isSupportedFileExtension,
  isSupportedFileMimeType,
} from './helpers';
import type { FileSelectionResult } from './types';

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('文件读取失败，请重试'));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败，请重试'));
    };

    reader.readAsDataURL(file);
  });
};

export const prepareFileForAnalyze = async (file: File): Promise<FileSelectionResult> => {
  const extension = getFileExtension(file.name);

  if (!isSupportedFileExtension(extension)) {
    throw new Error('仅支持 TXT、MD、CSV、JSON、PDF、DOCX 文件');
  }

  const normalizedMimeType = isSupportedFileMimeType(file.type)
    ? file.type
    : inferSupportedFileMimeType(file.type, extension);

  if (!isSupportedFileMimeType(normalizedMimeType)) {
    throw new Error('当前文件格式暂不支持解读');
  }

  if (!isFileSizeAllowed(file.size)) {
    throw new Error('文件大小需在 8MB 以内');
  }

  const dataUrl = await readFileAsDataUrl(file);

  return {
    fileName: file.name,
    mimeType: normalizedMimeType,
    size: file.size,
    extension,
    dataUrl,
  };
};