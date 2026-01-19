import { env } from '../config/env.js';

const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

type ImgbbImageAsset = {
  url?: string;
};

type ImgbbUploadResponse = {
  success?: boolean;
  status?: number;
  data?: {
    url?: string;
    image?: ImgbbImageAsset;
  };
  error?: { message?: string };
};

const parseDataUrl = (dataUrl: string): { mimeType: string; buffer: Buffer } => {
  const match = /^data:(.+);base64,(.*)$/i.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid image data URL');
  }
  const [, mimeType, base64] = match;
  return { mimeType, buffer: Buffer.from(base64, 'base64') };
};

const pickImgbbImageUrl = (data: NonNullable<ImgbbUploadResponse['data']>): string | undefined => {
  return data.url?.trim() || data.image?.url?.trim();
};

export const uploadImageToImgbb = async (params: {
  dataUrl: string;
  fileName?: string;
}): Promise<{ url: string }> => {
  const apiKey = env.IMGBB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('IMGBB_API_KEY is not configured');
  }

  const { mimeType, buffer } = parseDataUrl(params.dataUrl);
  const formData = new FormData();
  formData.append(
    'image',
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    params.fileName || 'image.png',
  );
  formData.append('key', apiKey);

  const response = await fetch(IMGBB_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  let payload: ImgbbUploadResponse;
  try {
    payload = (await response.json()) as ImgbbUploadResponse;
  } catch {
    throw new Error('ImgBB response parse failed');
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || 'ImgBB upload failed');
  }

  const url = payload.data ? pickImgbbImageUrl(payload.data) : undefined;
  if (!url) {
    throw new Error('ImgBB returned no image URL');
  }

  return { url };
};
