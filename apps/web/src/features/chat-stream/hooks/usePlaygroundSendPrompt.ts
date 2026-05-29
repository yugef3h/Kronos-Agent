import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { ensureKnowledgeDatasetAuthToken } from '../../../domains/knowledge/dataset-store';
import {
  requestFileAnalysis,
  requestImageRecognition,
  requestTakeoutOrchestration,
} from '../../../lib/api';
import {
  buildPublishedChatbotPlaygroundAugmentedPrompt,
  resolvePublishedChatbotForPlayground,
} from '../../../domains/workflow/app/publishedChatbotPlaygroundPrompt';
import { createAssistantInvocation } from '../assistantInvocation';
import type { AssistantInvocationSummary } from '../types';
import {
  FILE_DEFAULT_PROMPT,
  IMAGE_DEFAULT_PROMPT,
} from '../constants';
import type { FileSelectionResult } from '../../agent-tools/file';
import {
  resolveImageUrlForBackend,
  type ImageSelectionResult,
} from '../../agent-tools/image';
import { isTakeoutIntentPrompt } from '../../agent-tools/takeout';
import type { LocalChatMessage } from '../types';
import { markLastAssistantMessageIncomplete, withClientMessageId } from '../utils/chatStreamHelpers';
import {
  beginPlaygroundStreamRequest,
  interruptActivePlaygroundStream,
  type PlaygroundStreamRequestRefs,
} from './playgroundStreamRequest';
import type { PlaygroundStickToBottomRef } from './usePlaygroundPanelUi';

type UsePlaygroundSendPromptParams = {
  prompt: string;
  canSend: boolean;
  authToken: string;
  sessionId: string;
  playgroundChatStreamSessionId: string;
  publishedChatbotWorkflowAppId: string | null;
  pendingImage: ImageSelectionResult | null;
  pendingFile: FileSelectionResult | null;
  messages: LocalChatMessage[];
  isStreaming: boolean;
  isOrchestrating: boolean;
  isAnalyzingImage: boolean;
  isAwaitingTakeoutFollowup: boolean;
  stickToBottomRef: PlaygroundStickToBottomRef;
  pendingImageUploadRef: MutableRefObject<Promise<string | null> | null>;
  streamRefs: PlaygroundStreamRequestRefs;
  setMessages: Dispatch<SetStateAction<LocalChatMessage[]>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  setLatestUserQuestion: (value: string) => void;
  setPendingImage: Dispatch<SetStateAction<ImageSelectionResult | null>>;
  setPendingFile: Dispatch<SetStateAction<FileSelectionResult | null>>;
  setIsAnalyzingImage: Dispatch<SetStateAction<boolean>>;
  setIsOrchestrating: Dispatch<SetStateAction<boolean>>;
  setIsAwaitingTakeoutFollowup: Dispatch<SetStateAction<boolean>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  clearTimelineEvents: () => void;
  flushRemainingAssistantBuffer: () => void;
  abortStreamingAssistantMessage: () => void;
  resetAssistantStreamingState: () => void;
  startAssistantTypewriter: (
    content: string,
    options?: {
      replaceLastAssistant?: boolean;
      assistantInvocation?: AssistantInvocationSummary;
      onComplete?: () => void;
    },
  ) => void;
  startStreamingAssistantMessage: (assistantInvocation?: AssistantInvocationSummary) => void;
  executePlaygroundChatStream: (params: {
    requestId: number;
    controller: AbortController;
    streamPrompt: string;
    sessionUserContent?: string;
    streamSessionId: string;
    imageDataUrls?: string[];
    authToken?: string;
  }) => Promise<boolean>;
  startTakeoutConversation: (initialUserPrompt?: string) => Promise<void>;
  scheduleMemoryMetricsRefresh: () => void;
};

export const usePlaygroundSendPrompt = ({
  prompt,
  canSend,
  authToken,
  sessionId,
  playgroundChatStreamSessionId,
  publishedChatbotWorkflowAppId,
  pendingImage,
  pendingFile,
  messages,
  isStreaming,
  isOrchestrating,
  isAnalyzingImage,
  isAwaitingTakeoutFollowup,
  stickToBottomRef,
  pendingImageUploadRef,
  streamRefs,
  setMessages,
  setPrompt,
  setLatestUserQuestion,
  setPendingImage,
  setPendingFile,
  setIsAnalyzingImage,
  setIsOrchestrating,
  setIsAwaitingTakeoutFollowup,
  setIsStreaming,
  clearTimelineEvents,
  flushRemainingAssistantBuffer,
  abortStreamingAssistantMessage,
  resetAssistantStreamingState,
  startAssistantTypewriter,
  startStreamingAssistantMessage,
  executePlaygroundChatStream,
  startTakeoutConversation,
  scheduleMemoryMetricsRefresh,
}: UsePlaygroundSendPromptParams) => {
  const markLastAssistantIncomplete = useCallback(() => {
    setMessages((prev) => markLastAssistantMessageIncomplete(prev));
  }, [setMessages]);

  const sendPrompt = useCallback(async (overridePrompt?: string) => {
    const userPrompt = (overridePrompt ?? prompt).trim();

    if (!pendingImage && !pendingFile && !userPrompt) {
      return;
    }

    if (!overridePrompt && !canSend) {
      return;
    }

    stickToBottomRef.current = true;

    const resolvedAuthToken = authToken.trim() || await ensureKnowledgeDatasetAuthToken();

    if (pendingImage) {
      if (isStreaming || isOrchestrating || isAnalyzingImage) {
        return;
      }

      if (!resolvedAuthToken) {
        startAssistantTypewriter('识别图片前需要先准备 JWT。');
        return;
      }

      const imagePrompt = userPrompt || IMAGE_DEFAULT_PROMPT;
      const imageSnapshot = pendingImage;

      const imagePayload = await resolveImageUrlForBackend(
        imageSnapshot,
        pendingImageUploadRef.current,
      );
      pendingImageUploadRef.current = null;

      if (publishedChatbotWorkflowAppId) {
        const published = resolvePublishedChatbotForPlayground(publishedChatbotWorkflowAppId);
        if (published.kind === 'active' && published.orch.visionEnabled) {
          setMessages((prev) => [
            ...prev,
            withClientMessageId({
              role: 'user',
              content: '',
              imagePreviewUrl: imageSnapshot.dataUrl,
              imageName: imageSnapshot.fileName,
              isIncomplete: false,
            }),
            withClientMessageId({ role: 'user', content: imagePrompt, isIncomplete: false }),
            withClientMessageId({
              role: 'assistant',
              content: '',
              isIncomplete: false,
              assistantInvocation: createAssistantInvocation({ modalities: ['image'] }),
            }),
          ]);
          setLatestUserQuestion(imagePrompt);
          setPrompt('');
          setPendingImage(null);

          interruptActivePlaygroundStream(streamRefs, {
            flushRemainingAssistantBuffer,
            abortStreamingAssistantMessage,
            markLastAssistantIncomplete,
          });

          const { requestId, controller } = beginPlaygroundStreamRequest(streamRefs);

          clearTimelineEvents();
          startStreamingAssistantMessage(createAssistantInvocation({ modalities: ['image'] }));

          let streamCompleted = false;
          try {
            const streamPrompt = await buildPublishedChatbotPlaygroundAugmentedPrompt({
              authToken: resolvedAuthToken,
              userQuery: imagePrompt,
              workflowAppId: publishedChatbotWorkflowAppId,
            });
            const maxV = Math.min(10, Math.max(1, Math.round(published.orch.visionMaxImages ?? 3)));
            const imageDataUrls = [imagePayload].slice(0, maxV);
            streamCompleted = await executePlaygroundChatStream({
              requestId,
              controller,
              streamPrompt,
              sessionUserContent: imagePrompt,
              streamSessionId: playgroundChatStreamSessionId,
              imageDataUrls,
              authToken: resolvedAuthToken,
            });
          } catch (error) {
            const isInterruptedRequest = streamRefs.interruptedRequestIdsRef.current.has(requestId) || controller.signal.aborted;

            if (requestId === streamRefs.activeRequestIdRef.current) {
              abortStreamingAssistantMessage();
              if (!streamCompleted) {
                markLastAssistantIncomplete();
              }
              setIsStreaming(false);
              streamRefs.activeControllerRef.current = null;
            }

            streamRefs.interruptedRequestIdsRef.current.delete(requestId);

            if (isInterruptedRequest) {
              return;
            }

            const message = error instanceof Error ? error.message : '带图对话失败，请稍后重试';
            startAssistantTypewriter(message, {
              replaceLastAssistant: true,
              onComplete: () => {
                scheduleMemoryMetricsRefresh();
              },
            });
            return;
          }

          void scheduleMemoryMetricsRefresh();
          return;
        }
      }

      setMessages((prev) => [
        ...prev,
        withClientMessageId({
          role: 'user',
          content: '',
          imagePreviewUrl: imageSnapshot.dataUrl,
          imageName: imageSnapshot.fileName,
          isIncomplete: false,
        }),
        withClientMessageId({ role: 'user', content: imagePrompt, isIncomplete: false }),
        withClientMessageId({
          role: 'assistant',
          content: '',
          isIncomplete: false,
          assistantInvocation: createAssistantInvocation({ modalities: ['image'] }),
        }),
      ]);
      setLatestUserQuestion(imagePrompt);
      setPrompt('');
      setPendingImage(null);
      setIsAnalyzingImage(true);

      const imageInvocation = createAssistantInvocation({ modalities: ['image'] });

      try {
        const response = await requestImageRecognition({
          authToken: resolvedAuthToken,
          imageDataUrl: imagePayload,
          prompt: imagePrompt,
          sessionId,
        });

        startAssistantTypewriter(response.reply, {
          replaceLastAssistant: true,
          assistantInvocation: imageInvocation,
          onComplete: () => {
            scheduleMemoryMetricsRefresh();
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '图片识别失败，请稍后重试';
        startAssistantTypewriter(message, {
          replaceLastAssistant: true,
          assistantInvocation: imageInvocation,
          onComplete: () => {
            scheduleMemoryMetricsRefresh();
          },
        });
      } finally {
        setIsAnalyzingImage(false);
      }

      return;
    }

    if (pendingFile) {
      if (isStreaming || isOrchestrating || isAnalyzingImage) {
        return;
      }

      if (!resolvedAuthToken) {
        startAssistantTypewriter('解读文件前需要先准备 JWT。');
        return;
      }

      const filePrompt = userPrompt || FILE_DEFAULT_PROMPT;

      setMessages((prev) => [
        ...prev,
        withClientMessageId({
          role: 'user',
          content: '',
          fileName: pendingFile.fileName,
          fileExtension: pendingFile.extension,
          fileSize: pendingFile.size,
          isIncomplete: false,
        }),
        withClientMessageId({ role: 'user', content: filePrompt, isIncomplete: false }),
        withClientMessageId({
          role: 'assistant',
          content: '',
          isIncomplete: false,
          assistantInvocation: createAssistantInvocation({ modalities: ['file'] }),
        }),
      ]);
      setLatestUserQuestion(filePrompt);
      setPrompt('');
      setPendingFile(null);
      setIsAnalyzingImage(true);

      const fileInvocation = createAssistantInvocation({ modalities: ['file'] });

      try {
        const response = await requestFileAnalysis({
          authToken: resolvedAuthToken,
          fileDataUrl: pendingFile.dataUrl,
          fileName: pendingFile.fileName,
          mimeType: pendingFile.mimeType,
          prompt: filePrompt,
          sessionId,
        });

        startAssistantTypewriter(response.reply, {
          replaceLastAssistant: true,
          assistantInvocation: fileInvocation,
          onComplete: () => {
            scheduleMemoryMetricsRefresh();
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '文件解读失败，请稍后重试';
        startAssistantTypewriter(message, {
          replaceLastAssistant: true,
          assistantInvocation: fileInvocation,
          onComplete: () => {
            scheduleMemoryMetricsRefresh();
          },
        });
      } finally {
        setIsAnalyzingImage(false);
      }

      return;
    }

    setMessages((prev) => [...prev, withClientMessageId({ role: 'user', content: userPrompt, isIncomplete: false })]);
    setPrompt('');
    setLatestUserQuestion(userPrompt);

    const tryHandleTakeout = async (): Promise<boolean> => {
      if (!resolvedAuthToken) {
        if (isAwaitingTakeoutFollowup) {
          startAssistantTypewriter('请先完成 JWT 鉴权后再继续点餐，我会根据你的具体需求进入外卖流程。');
          return true;
        }

        return isTakeoutIntentPrompt(userPrompt);
      }

      try {
        setIsOrchestrating(true);
        const orchestrated = await requestTakeoutOrchestration({
          authToken: resolvedAuthToken,
          prompt: userPrompt,
          history: messages.slice(-6).map((message) => message.content),
          sessionId,
        });

        if (orchestrated.action === 'delegate_chat_stream') {
          return false;
        }

        if (orchestrated.action === 'chat' || orchestrated.action === 'ask_slot') {
          startAssistantTypewriter(orchestrated.assistantReply, {
            onComplete: () => {
              scheduleMemoryMetricsRefresh();
            },
          });
          return true;
        }

        if (orchestrated.action === 'tool_call' && orchestrated.toolCall?.name === 'takeout') {
          if (isAwaitingTakeoutFollowup) {
            setIsAwaitingTakeoutFollowup(false);
          }

          await startTakeoutConversation(userPrompt);
          scheduleMemoryMetricsRefresh();
          return true;
        }

        return false;
      } catch {
        if (isTakeoutIntentPrompt(userPrompt)) {
          if (isAwaitingTakeoutFollowup) {
            setIsAwaitingTakeoutFollowup(false);
          }

          await startTakeoutConversation(userPrompt);
          scheduleMemoryMetricsRefresh();
          return true;
        }

        return false;
      } finally {
        setIsOrchestrating(false);
      }
    };

    if (await tryHandleTakeout()) {
      return;
    }

    if (
      !publishedChatbotWorkflowAppId
      && !resolvedAuthToken
      && !isAwaitingTakeoutFollowup
      && isTakeoutIntentPrompt(userPrompt)
    ) {
      await startTakeoutConversation();
      return;
    }

    if (!resolvedAuthToken) {
      startAssistantTypewriter('发送前需要先准备 JWT。');
      return;
    }

    interruptActivePlaygroundStream(streamRefs, {
      flushRemainingAssistantBuffer,
      abortStreamingAssistantMessage,
      markLastAssistantIncomplete,
    });

    const { requestId, controller } = beginPlaygroundStreamRequest(streamRefs);

    clearTimelineEvents();
    resetAssistantStreamingState();
    startStreamingAssistantMessage();

    let streamPrompt = userPrompt;
    if (publishedChatbotWorkflowAppId) {
      try {
        streamPrompt = await buildPublishedChatbotPlaygroundAugmentedPrompt({
          authToken: resolvedAuthToken,
          userQuery: userPrompt,
          workflowAppId: publishedChatbotWorkflowAppId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'RAG 应用检索失败，请稍后重试';
        abortStreamingAssistantMessage();
        startAssistantTypewriter(message, { replaceLastAssistant: true });
        setIsStreaming(false);
        streamRefs.activeControllerRef.current = null;
        streamRefs.interruptedRequestIdsRef.current.delete(requestId);
        return;
      }
    }

    let streamCompleted = false;
    try {
      streamCompleted = await executePlaygroundChatStream({
        requestId,
        controller,
        streamPrompt,
        ...(publishedChatbotWorkflowAppId ? { sessionUserContent: userPrompt } : {}),
        streamSessionId: playgroundChatStreamSessionId,
        authToken: resolvedAuthToken,
      });
    } catch {
      const isInterruptedRequest = streamRefs.interruptedRequestIdsRef.current.has(requestId) || controller.signal.aborted;

      if (requestId === streamRefs.activeRequestIdRef.current) {
        abortStreamingAssistantMessage();
        if (!streamCompleted) {
          markLastAssistantIncomplete();
        }
        setIsStreaming(false);
        streamRefs.activeControllerRef.current = null;
      }

      streamRefs.interruptedRequestIdsRef.current.delete(requestId);

      if (isInterruptedRequest) {
        return;
      }
    }
  }, [
    abortStreamingAssistantMessage,
    authToken,
    canSend,
    clearTimelineEvents,
    executePlaygroundChatStream,
    flushRemainingAssistantBuffer,
    isAnalyzingImage,
    isAwaitingTakeoutFollowup,
    isOrchestrating,
    isStreaming,
    markLastAssistantIncomplete,
    messages,
    pendingFile,
    pendingImage,
    pendingImageUploadRef,
    playgroundChatStreamSessionId,
    prompt,
    publishedChatbotWorkflowAppId,
    resetAssistantStreamingState,
    scheduleMemoryMetricsRefresh,
    sessionId,
    setIsAnalyzingImage,
    setIsAwaitingTakeoutFollowup,
    setIsOrchestrating,
    setIsStreaming,
    setLatestUserQuestion,
    setMessages,
    setPendingFile,
    setPendingImage,
    setPrompt,
    startAssistantTypewriter,
    startStreamingAssistantMessage,
    startTakeoutConversation,
    stickToBottomRef,
    streamRefs,
  ]);

  return { sendPrompt };
};
