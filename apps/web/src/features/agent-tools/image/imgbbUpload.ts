import { requestImageHostUpload } from '../../../lib/api';
import type { ImageSelectionResult } from './types';

/** 经后端代理上传 ImgBB；失败时由调用方兜底 dataUrl */
export const uploadImageToImgbb = async (
  selection: ImageSelectionResult,
  authToken: string,
): Promise<string> => {
  const { url } = await requestImageHostUpload({
    authToken,
    imageDataUrl: selection.dataUrl,
    fileName: selection.fileName,
  });
  return url;
};

/** 优先远端链接；上传中则等待，失败则用 dataUrl */
export const resolveImageUrlForBackend = async (
  selection: ImageSelectionResult,
  inFlightUpload?: Promise<string | null> | null,
): Promise<string> => {
  if (selection.remoteUrl) {
    return selection.remoteUrl;
  }

  if (inFlightUpload) {
    const url = await inFlightUpload;
    if (url) {
      return url;
    }
  }

  return selection.dataUrl;
};
