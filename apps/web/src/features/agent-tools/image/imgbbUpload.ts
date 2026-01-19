import type { ImageSelectionResult } from './types';

const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

type ImgbbUploadResponse = {
  success?: boolean;
  status?: number;
  data?: { url?: string };
  error?: { message?: string };
};

const readImgbbApiKey = (): string => {
  try {
    const key = Function('return import.meta?.env?.VITE_IMGBB_API_KEY')() as string | undefined;
    return key?.trim() ?? '';
  } catch {
    return '';
  }
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error('图片读取失败，请重试');
  }
  return response.blob();
};

/** 将待发送图片上传至 ImgBB，返回可给 LLM / 后端的 HTTPS 链接 */
export const uploadImageToImgbb = async (selection: ImageSelectionResult): Promise<string> => {
  const apiKey = readImgbbApiKey();
  if (!apiKey) {
    throw new Error('未配置图床 API Key，请在环境变量中设置 VITE_IMGBB_API_KEY');
  }

  const blob = await dataUrlToBlob(selection.dataUrl);
  const formData = new FormData();
  formData.append('image', blob, selection.fileName);
  formData.append('key', apiKey);

  const response = await fetch(IMGBB_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  let payload: ImgbbUploadResponse;
  try {
    payload = (await response.json()) as ImgbbUploadResponse;
  } catch {
    throw new Error('图床响应解析失败，请稍后重试');
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || '图床上传失败，请稍后重试');
  }

  const url = payload.data?.url?.trim();
  if (!url) {
    throw new Error('图床未返回图片链接，请稍后重试');
  }

  return url;
};
