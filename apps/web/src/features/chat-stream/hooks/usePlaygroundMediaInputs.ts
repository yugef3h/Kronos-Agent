import { useCallback, useRef, type ChangeEvent, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { prepareFileForAnalyze, type FileSelectionResult } from '../../agent-tools/file';
import {
  prepareImageForAnalyze,
  uploadImageToImgbb,
  type ImageSelectionResult,
} from '../../agent-tools/image';
import { FILE_DEFAULT_PROMPT, IMAGE_DEFAULT_PROMPT } from '../constants';

type UsePlaygroundMediaInputsParams = {
  authToken: string;
  prompt: string;
  pendingImage: ImageSelectionResult | null;
  pendingFile: FileSelectionResult | null;
  promptTextareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  pendingImageUploadRef: MutableRefObject<Promise<string | null> | null>;
  setPendingFile: Dispatch<SetStateAction<FileSelectionResult | null>>;
  setPendingImage: Dispatch<SetStateAction<ImageSelectionResult | null>>;
  startAssistantTypewriter: (content: string) => void;
  sendPrompt: (overridePrompt?: string) => Promise<void>;
};

export const usePlaygroundMediaInputs = ({
  authToken,
  prompt,
  pendingImage,
  pendingFile,
  promptTextareaRef,
  pendingImageUploadRef,
  setPendingFile,
  setPendingImage,
  startAssistantTypewriter,
  sendPrompt,
}: UsePlaygroundMediaInputsParams) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const handleExplainImageClick = useCallback(() => {
    if (!pendingImage || prompt.trim().length > 0) {
      return;
    }

    void sendPrompt(IMAGE_DEFAULT_PROMPT);
  }, [pendingImage, prompt, sendPrompt]);

  const handleExplainFileClick = useCallback(() => {
    if (!pendingFile || prompt.trim().length > 0) {
      return;
    }

    void sendPrompt(FILE_DEFAULT_PROMPT);
  }, [pendingFile, prompt, sendPrompt]);

  const handleImageFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    try {
      const preparedImage = await prepareImageForAnalyze(selectedFile);
      setPendingFile(null);
      setPendingImage({ ...preparedImage, imgbbUploadState: 'pending' });

      if (!authToken) {
        setPendingImage({ ...preparedImage, imgbbUploadState: 'failed' });
        requestAnimationFrame(() => {
          promptTextareaRef.current?.focus();
        });
        return;
      }

      const uploadPromise = uploadImageToImgbb(preparedImage, authToken)
        .then((remoteUrl) => {
          setPendingImage((prev) => {
            if (!prev || prev.dataUrl !== preparedImage.dataUrl) {
              return prev;
            }
            return { ...prev, remoteUrl, imgbbUploadState: 'ready' };
          });
          return remoteUrl;
        })
        .catch(() => {
          setPendingImage((prev) => {
            if (!prev || prev.dataUrl !== preparedImage.dataUrl) {
              return prev;
            }
            return { ...prev, imgbbUploadState: 'failed' };
          });
          return null;
        });

      pendingImageUploadRef.current = uploadPromise;

      requestAnimationFrame(() => {
        promptTextareaRef.current?.focus();
      });
    } catch (error) {
      pendingImageUploadRef.current = null;
      const message = error instanceof Error ? error.message : '图片识别失败，请稍后重试';
      startAssistantTypewriter(message);
    }
  }, [authToken, promptTextareaRef, setPendingFile, setPendingImage, startAssistantTypewriter]);

  const handleDocumentFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    try {
      const preparedFile = await prepareFileForAnalyze(selectedFile);
      setPendingImage(null);
      setPendingFile(preparedFile);
      requestAnimationFrame(() => {
        promptTextareaRef.current?.focus();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '文件读取失败，请稍后重试';
      startAssistantTypewriter(message);
    }
  }, [promptTextareaRef, setPendingFile, setPendingImage, startAssistantTypewriter]);

  return {
    fileInputRef,
    handleDocumentFileChange,
    handleExplainFileClick,
    handleExplainImageClick,
    handleImageFileChange,
    imageInputRef,
  };
};
