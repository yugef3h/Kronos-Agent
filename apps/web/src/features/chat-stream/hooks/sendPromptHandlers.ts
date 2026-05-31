import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

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
import { FILE_DEFAULT_PROMPT, IMAGE_DEFAULT_PROMPT } from '../constants';
import type { FileSelectionResult } from '../../agent-tools/file';
import { resolveImageUrlForBackend, type ImageSelectionResult } from '../../agent-tools/image';
import { isTakeoutIntentPrompt } from '../../agent-tools/takeout';
import type { LocalChatMessage } from '../types';
import { withClientMessageId } from '../utils/chatStreamHelpers';
import {
  beginPlaygroundStreamRequest,
  interruptActivePlaygroundStream,
  type PlaygroundStreamRequestRefs,
} from './playgroundStreamRequest';
import type { PlaygroundStickToBottomRef } from './usePlaygroundPanelUi';

export type SendPromptContext = {
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
  markLastAssistantIncomplete: () => void;
};

export async function handleSendImagePrompt(ctx: SendPromptContext): Promise<boolean> {
  const {
    prompt, isStreaming, isOrchestrating, isAnalyzingImage, pendingImage,
    publishedChatbotWorkflowAppId, playgroundChatStreamSessionId,
    pendingImageUploadRef, streamRefs, sessionId, authToken,
  } = ctx;

  if (isStreaming || isOrchestrating || isAnalyzingImage) {
    return false;
  }

  const resolvedAuthToken = authToken.trim() || await ensureKnowledgeDatasetAuthToken();
  if (!resolvedAuthToken) {
    ctx.startAssistantTypewriter('识别图片前需要先准备 JWT。');
    return false;
  }

  const imagePrompt = prompt || IMAGE_DEFAULT_PROMPT;
  const imageSnapshot = pendingImage!;

  const imagePayload = await resolveImageUrlForBackend(
    imageSnapshot,
    pendingImageUploadRef.current,
  );
  pendingImageUploadRef.current = null;

  if (publishedChatbotWorkflowAppId) {
    const published = resolvePublishedChatbotForPlayground(publishedChatbotWorkflowAppId);
    if (published.kind === 'active' && published.orch.visionEnabled) {
      ctx.setMessages((prev) => [
        ...prev,
        withClientMessageId({
          role: 'user', content: '',
          imagePreviewUrl: imageSnapshot.dataUrl, imageName: imageSnapshot.fileName,
          isIncomplete: false,
        }),
        withClientMessageId({ role: 'user', content: imagePrompt, isIncomplete: false }),
        withClientMessageId({
          role: 'assistant', content: '', isIncomplete: false,
          assistantInvocation: createAssistantInvocation({ modalities: ['image'] }),
        }),
      ]);
      ctx.setLatestUserQuestion(imagePrompt);
      ctx.setPrompt('');
      ctx.setPendingImage(null);

      interruptActivePlaygroundStream(streamRefs, {
        flushRemainingAssistantBuffer: ctx.flushRemainingAssistantBuffer,
        abortStreamingAssistantMessage: ctx.abortStreamingAssistantMessage,
        markLastAssistantIncomplete: ctx.markLastAssistantIncomplete,
      });

      const { requestId, controller } = beginPlaygroundStreamRequest(streamRefs);
      ctx.clearTimelineEvents();
      ctx.startStreamingAssistantMessage(createAssistantInvocation({ modalities: ['image'] }));

      try {
        const streamPrompt = await buildPublishedChatbotPlaygroundAugmentedPrompt({
          authToken: resolvedAuthToken,
          userQuery: imagePrompt,
          workflowAppId: publishedChatbotWorkflowAppId,
        });
        const maxV = Math.min(10, Math.max(1, Math.round(published.orch.visionMaxImages ?? 3)));
        const imageDataUrls = [imagePayload].slice(0, maxV);
        await ctx.executePlaygroundChatStream({
          requestId, controller, streamPrompt,
          sessionUserContent: imagePrompt,
          streamSessionId: playgroundChatStreamSessionId,
          imageDataUrls, authToken: resolvedAuthToken,
        });
      } catch (error) {
        const isInterruptedRequest = streamRefs.interruptedRequestIdsRef.current.has(requestId) || controller.signal.aborted;
        if (requestId === streamRefs.activeRequestIdRef.current) {
          ctx.abortStreamingAssistantMessage();
          ctx.markLastAssistantIncomplete();
          ctx.setIsStreaming(false);
          streamRefs.activeControllerRef.current = null;
        }
        streamRefs.interruptedRequestIdsRef.current.delete(requestId);
        if (isInterruptedRequest) {
          return true;
        }
        const message = error instanceof Error ? error.message : '带图对话失败，请稍后重试';
        ctx.startAssistantTypewriter(message, { replaceLastAssistant: true, onComplete: () => { ctx.scheduleMemoryMetricsRefresh(); } });
        return true;
      }

      ctx.scheduleMemoryMetricsRefresh();
      return true;
    }
  }

  // Non-published chatbot: direct image recognition
  ctx.setMessages((prev) => [
    ...prev,
    withClientMessageId({
      role: 'user', content: '',
      imagePreviewUrl: imageSnapshot.dataUrl, imageName: imageSnapshot.fileName,
      isIncomplete: false,
    }),
    withClientMessageId({ role: 'user', content: imagePrompt, isIncomplete: false }),
    withClientMessageId({
      role: 'assistant', content: '', isIncomplete: false,
      assistantInvocation: createAssistantInvocation({ modalities: ['image'] }),
    }),
  ]);
  ctx.setLatestUserQuestion(imagePrompt);
  ctx.setPrompt('');
  ctx.setPendingImage(null);
  ctx.setIsAnalyzingImage(true);

  const imageInvocation = createAssistantInvocation({ modalities: ['image'] });
  try {
    const response = await requestImageRecognition({
      authToken: resolvedAuthToken, imageDataUrl: imagePayload,
      prompt: imagePrompt, sessionId,
    });
    ctx.startAssistantTypewriter(response.reply, {
      replaceLastAssistant: true, assistantInvocation: imageInvocation,
      onComplete: () => { ctx.scheduleMemoryMetricsRefresh(); },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '图片识别失败，请稍后重试';
    ctx.startAssistantTypewriter(message, {
      replaceLastAssistant: true, assistantInvocation: imageInvocation,
      onComplete: () => { ctx.scheduleMemoryMetricsRefresh(); },
    });
  } finally {
    ctx.setIsAnalyzingImage(false);
  }
  return true;
}

export async function handleSendFilePrompt(ctx: SendPromptContext): Promise<boolean> {
  const {
    prompt, isStreaming, isOrchestrating, isAnalyzingImage, pendingFile,
    sessionId, authToken,
  } = ctx;

  if (isStreaming || isOrchestrating || isAnalyzingImage) {
    return false;
  }

  const resolvedAuthToken = authToken.trim() || await ensureKnowledgeDatasetAuthToken();
  if (!resolvedAuthToken) {
    ctx.startAssistantTypewriter('解读文件前需要先准备 JWT。');
    return false;
  }

  const filePrompt = prompt || FILE_DEFAULT_PROMPT;
  const fileSnapshot = pendingFile!;

  ctx.setMessages((prev) => [
    ...prev,
    withClientMessageId({
      role: 'user', content: '',
      fileName: fileSnapshot.fileName, fileExtension: fileSnapshot.extension,
      fileSize: fileSnapshot.size, isIncomplete: false,
    }),
    withClientMessageId({ role: 'user', content: filePrompt, isIncomplete: false }),
    withClientMessageId({
      role: 'assistant', content: '', isIncomplete: false,
      assistantInvocation: createAssistantInvocation({ modalities: ['file'] }),
    }),
  ]);
  ctx.setLatestUserQuestion(filePrompt);
  ctx.setPrompt('');
  ctx.setPendingFile(null);
  ctx.setIsAnalyzingImage(true);

  const fileInvocation = createAssistantInvocation({ modalities: ['file'] });
  try {
    const response = await requestFileAnalysis({
      authToken: resolvedAuthToken, fileDataUrl: fileSnapshot.dataUrl,
      fileName: fileSnapshot.fileName, mimeType: fileSnapshot.mimeType,
      prompt: filePrompt, sessionId,
    });
    ctx.startAssistantTypewriter(response.reply, {
      replaceLastAssistant: true, assistantInvocation: fileInvocation,
      onComplete: () => { ctx.scheduleMemoryMetricsRefresh(); },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '文件解读失败，请稍后重试';
    ctx.startAssistantTypewriter(message, {
      replaceLastAssistant: true, assistantInvocation: fileInvocation,
      onComplete: () => { ctx.scheduleMemoryMetricsRefresh(); },
    });
  } finally {
    ctx.setIsAnalyzingImage(false);
  }
  return true;
}

export async function handleSendTextPrompt(ctx: SendPromptContext, userPrompt: string): Promise<void> {
  const {
    isAwaitingTakeoutFollowup, publishedChatbotWorkflowAppId, playgroundChatStreamSessionId,
    streamRefs, authToken,
  } = ctx;

  ctx.setMessages((prev) => [...prev, withClientMessageId({ role: 'user', content: userPrompt, isIncomplete: false })]);
  ctx.setPrompt('');
  ctx.setLatestUserQuestion(userPrompt);

  const resolvedAuthToken = authToken.trim() || await ensureKnowledgeDatasetAuthToken();

  // Try takeout orchestration
  if (await tryHandleTakeoutOrchestration(ctx, userPrompt, resolvedAuthToken)) {
    return;
  }

  // Fallback: no auth + takeout intent
  if (!publishedChatbotWorkflowAppId && !resolvedAuthToken && !isAwaitingTakeoutFollowup && isTakeoutIntentPrompt(userPrompt)) {
    await ctx.startTakeoutConversation();
    return;
  }

  if (!resolvedAuthToken) {
    ctx.startAssistantTypewriter('发送前需要先准备 JWT。');
    return;
  }

  interruptActivePlaygroundStream(streamRefs, {
    flushRemainingAssistantBuffer: ctx.flushRemainingAssistantBuffer,
    abortStreamingAssistantMessage: ctx.abortStreamingAssistantMessage,
    markLastAssistantIncomplete: ctx.markLastAssistantIncomplete,
  });

  const { requestId, controller } = beginPlaygroundStreamRequest(streamRefs);
  ctx.clearTimelineEvents();
  ctx.resetAssistantStreamingState();
  ctx.startStreamingAssistantMessage();

  let streamPrompt = userPrompt;
  if (publishedChatbotWorkflowAppId) {
    try {
      streamPrompt = await buildPublishedChatbotPlaygroundAugmentedPrompt({
        authToken: resolvedAuthToken, userQuery: userPrompt,
        workflowAppId: publishedChatbotWorkflowAppId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'RAG 应用检索失败，请稍后重试';
      ctx.abortStreamingAssistantMessage();
      ctx.startAssistantTypewriter(message, { replaceLastAssistant: true });
      ctx.setIsStreaming(false);
      streamRefs.activeControllerRef.current = null;
      streamRefs.interruptedRequestIdsRef.current.delete(requestId);
      return;
    }
  }

  try {
    await ctx.executePlaygroundChatStream({
      requestId, controller, streamPrompt,
      ...(publishedChatbotWorkflowAppId ? { sessionUserContent: userPrompt } : {}),
      streamSessionId: playgroundChatStreamSessionId,
      authToken: resolvedAuthToken,
    });
  } catch {
    const isInterruptedRequest = streamRefs.interruptedRequestIdsRef.current.has(requestId) || controller.signal.aborted;
    if (requestId === streamRefs.activeRequestIdRef.current) {
      ctx.abortStreamingAssistantMessage();
      ctx.markLastAssistantIncomplete();
      ctx.setIsStreaming(false);
      streamRefs.activeControllerRef.current = null;
    }
    streamRefs.interruptedRequestIdsRef.current.delete(requestId);
    if (isInterruptedRequest) {
      return;
    }
  }
}

async function tryHandleTakeoutOrchestration(
  ctx: SendPromptContext,
  userPrompt: string,
  resolvedAuthToken: string,
): Promise<boolean> {
  const { isAwaitingTakeoutFollowup, messages, sessionId } = ctx;

  if (!resolvedAuthToken) {
    if (isAwaitingTakeoutFollowup) {
      ctx.startAssistantTypewriter('请先完成 JWT 鉴权后再继续点餐，我会根据你的具体需求进入外卖流程。');
      return true;
    }
    return isTakeoutIntentPrompt(userPrompt);
  }

  try {
    ctx.setIsOrchestrating(true);
    const orchestrated = await requestTakeoutOrchestration({
      authToken: resolvedAuthToken, prompt: userPrompt,
      history: messages.slice(-6).map((message) => message.content), sessionId,
    });

    if (orchestrated.action === 'delegate_chat_stream') {
      return false;
    }

    if (orchestrated.action === 'chat' || orchestrated.action === 'ask_slot') {
      ctx.startAssistantTypewriter(orchestrated.assistantReply, {
        onComplete: () => { ctx.scheduleMemoryMetricsRefresh(); },
      });
      return true;
    }

    if (orchestrated.action === 'tool_call' && orchestrated.toolCall?.name === 'takeout') {
      if (isAwaitingTakeoutFollowup) {
        ctx.setIsAwaitingTakeoutFollowup(false);
      }
      await ctx.startTakeoutConversation(userPrompt);
      ctx.scheduleMemoryMetricsRefresh();
      return true;
    }

    return false;
  } catch {
    if (isTakeoutIntentPrompt(userPrompt)) {
      if (isAwaitingTakeoutFollowup) {
        ctx.setIsAwaitingTakeoutFollowup(false);
      }
      await ctx.startTakeoutConversation(userPrompt);
      ctx.scheduleMemoryMetricsRefresh();
      return true;
    }
    return false;
  } finally {
    ctx.setIsOrchestrating(false);
  }
}
