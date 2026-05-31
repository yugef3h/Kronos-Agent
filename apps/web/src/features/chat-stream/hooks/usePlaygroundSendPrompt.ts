import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import type { AssistantInvocationSummary, LocalChatMessage } from '../types';
import type { FileSelectionResult } from '../../agent-tools/file';
import type { ImageSelectionResult } from '../../agent-tools/image';
import { markLastAssistantMessageIncomplete } from '../utils/chatStreamHelpers';
import type { PlaygroundStreamRequestRefs } from './playgroundStreamRequest';
import type { PlaygroundStickToBottomRef } from './usePlaygroundPanelUi';
import {
  handleSendImagePrompt,
  handleSendFilePrompt,
  handleSendTextPrompt,
  type SendPromptContext,
} from './sendPromptHandlers';

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

export const usePlaygroundSendPrompt = (params: UsePlaygroundSendPromptParams) => {
  const {
    prompt, canSend, authToken, sessionId, playgroundChatStreamSessionId,
    publishedChatbotWorkflowAppId, pendingImage, pendingFile, messages,
    isStreaming, isOrchestrating, isAnalyzingImage, isAwaitingTakeoutFollowup,
    stickToBottomRef, pendingImageUploadRef, streamRefs,
    setMessages, setPrompt, setLatestUserQuestion, setPendingImage, setPendingFile,
    setIsAnalyzingImage, setIsOrchestrating, setIsAwaitingTakeoutFollowup, setIsStreaming,
    clearTimelineEvents, flushRemainingAssistantBuffer, abortStreamingAssistantMessage,
    resetAssistantStreamingState, startAssistantTypewriter, startStreamingAssistantMessage,
    executePlaygroundChatStream, startTakeoutConversation, scheduleMemoryMetricsRefresh,
  } = params;

  const markLastAssistantIncomplete = useCallback(() => {
    setMessages((prev) => markLastAssistantMessageIncomplete(prev));
  }, [setMessages]);

  const buildContext = useCallback((): SendPromptContext => ({
    prompt, canSend, authToken, sessionId, playgroundChatStreamSessionId,
    publishedChatbotWorkflowAppId, pendingImage, pendingFile, messages,
    isStreaming, isOrchestrating, isAnalyzingImage, isAwaitingTakeoutFollowup,
    stickToBottomRef, pendingImageUploadRef, streamRefs,
    setMessages, setPrompt, setLatestUserQuestion, setPendingImage, setPendingFile,
    setIsAnalyzingImage, setIsOrchestrating, setIsAwaitingTakeoutFollowup, setIsStreaming,
    clearTimelineEvents, flushRemainingAssistantBuffer, abortStreamingAssistantMessage,
    resetAssistantStreamingState, startAssistantTypewriter, startStreamingAssistantMessage,
    executePlaygroundChatStream, startTakeoutConversation, scheduleMemoryMetricsRefresh,
    markLastAssistantIncomplete,
  }), [
    prompt, canSend, authToken, sessionId, playgroundChatStreamSessionId,
    publishedChatbotWorkflowAppId, pendingImage, pendingFile, messages,
    isStreaming, isOrchestrating, isAnalyzingImage, isAwaitingTakeoutFollowup,
    stickToBottomRef, pendingImageUploadRef, streamRefs,
    setMessages, setPrompt, setLatestUserQuestion, setPendingImage, setPendingFile,
    setIsAnalyzingImage, setIsOrchestrating, setIsAwaitingTakeoutFollowup, setIsStreaming,
    clearTimelineEvents, flushRemainingAssistantBuffer, abortStreamingAssistantMessage,
    resetAssistantStreamingState, startAssistantTypewriter, startStreamingAssistantMessage,
    executePlaygroundChatStream, startTakeoutConversation, scheduleMemoryMetricsRefresh,
    markLastAssistantIncomplete,
  ]);

  const sendPrompt = useCallback(async (overridePrompt?: string) => {
    const userPrompt = (overridePrompt ?? prompt).trim();
    if (!pendingImage && !pendingFile && !userPrompt) return;
    if (!overridePrompt && !canSend) return;

    stickToBottomRef.current = true;
    const ctx = buildContext();

    if (pendingImage) {
      await handleSendImagePrompt(ctx);
      return;
    }

    if (pendingFile) {
      await handleSendFilePrompt(ctx);
      return;
    }

    await handleSendTextPrompt(ctx, userPrompt);
  }, [
    prompt, canSend, pendingImage, pendingFile,
    stickToBottomRef, buildContext,
  ]);

  return { sendPrompt };
};
