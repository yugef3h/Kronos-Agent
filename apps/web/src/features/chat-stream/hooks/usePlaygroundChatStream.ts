import { useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { apiUrl } from '../../../lib/api';
import { usePlaygroundStore } from '../../../store/playgroundStore';
import type { ChatAsyncAccepted } from '../../../types/chatAsyncTask';
import type { StreamChunk, TimelineEvent } from '../../../types/chat';
import { CHAT_ASYNC_THRESHOLD_CHARS } from '../constants';
import {
  consumeAiTaskEventsSse,
  consumeChatStreamSseResponse,
} from '../utils/consumeAiTaskEventsSse';
import {
  extractToolNamesFromTimeline,
  type mergeAssistantInvocation,
} from '../assistantInvocation';
import { isPlaygroundToolName } from '../invocationRegistry';
import type { LocalChatMessage } from '../types';
import { markLastAssistantMessageIncomplete } from '../utils/chatStreamHelpers';

type UsePlaygroundChatStreamParams = {
  authToken: string;
  activeRequestIdRef: MutableRefObject<number>;
  interruptedRequestIdsRef: MutableRefObject<Set<number>>;
  activeControllerRef: MutableRefObject<AbortController | null>;
  appendStreamingContent: (content: string) => void;
  appendTimelineEvent: (event: TimelineEvent) => void;
  abortStreamingAssistantMessage: () => void;
  completeStreamingContent: () => void;
  setMessages: Dispatch<SetStateAction<LocalChatMessage[]>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  patchLastAssistantInvocation: (patch: Parameters<typeof mergeAssistantInvocation>[1]) => void;
};

export const usePlaygroundChatStream = ({
  authToken,
  activeRequestIdRef,
  interruptedRequestIdsRef,
  activeControllerRef,
  appendStreamingContent,
  appendTimelineEvent,
  abortStreamingAssistantMessage,
  completeStreamingContent,
  setMessages,
  setIsStreaming,
  patchLastAssistantInvocation,
}: UsePlaygroundChatStreamParams) => {
  const executePlaygroundChatStream = useCallback(
    async (params: {
      requestId: number;
      controller: AbortController;
      streamPrompt: string;
      sessionUserContent?: string;
      streamSessionId: string;
      imageDataUrls?: string[];
      authToken?: string;
    }) => {
      const streamAuthToken = (params.authToken ?? authToken).trim()
        || usePlaygroundStore.getState().authToken.trim();
      if (!streamAuthToken) {
        return false;
      }

      const { requestId, controller, streamPrompt, sessionUserContent, streamSessionId, imageDataUrls } = params;
      let lastSeenEventId = 0;
      let isRequestComplete = false;

      const requestBody = JSON.stringify({
        prompt: streamPrompt,
        sessionId: streamSessionId,
        ...(typeof sessionUserContent === 'string' && sessionUserContent.trim().length > 0
          ? { sessionUserContent: sessionUserContent.trim() }
          : {}),
        ...(imageDataUrls?.length ? { imageDataUrls } : {}),
      });

      const handleStreamChunk = (payload: StreamChunk) => {
        if (requestId !== activeRequestIdRef.current) {
          return;
        }

        if (payload.eventId <= lastSeenEventId) {
          return;
        }
        lastSeenEventId = payload.eventId;

        if (payload.type === 'timeline') {
          appendTimelineEvent({
            eventId: payload.eventId,
            stage: payload.stage,
            status: payload.status,
            message: payload.message,
            toolName: payload.toolName,
            toolInput: payload.toolInput,
            toolOutput: payload.toolOutput,
            toolError: payload.toolError,
            timestamp: payload.timestamp,
          });

          if (payload.message.includes('LangChain 流式响应失败')) {
            console.warn(`[ChatStreamPanel] ${payload.message}`);
          }

          if (
            payload.stage === 'tool'
            && payload.status === 'end'
            && payload.toolName
            && isPlaygroundToolName(payload.toolName)
          ) {
            patchLastAssistantInvocation({ tools: [payload.toolName] });
          }
        }

        if (payload.type === 'content') {
          appendStreamingContent(payload.content);
        }

        if (payload.type === 'complete') {
          isRequestComplete = true;
          if (requestId === activeRequestIdRef.current) {
            const tools = extractToolNamesFromTimeline(usePlaygroundStore.getState().timelineEvents);
            if (tools.length > 0) {
              patchLastAssistantInvocation({ tools });
            }
            completeStreamingContent();
          }
        }
      };

      const finishIncompleteStream = () => {
        if (!isRequestComplete && requestId === activeRequestIdRef.current) {
          abortStreamingAssistantMessage();
          setMessages((prev) => markLastAssistantMessageIncomplete(prev));
        }

        if (!isRequestComplete && requestId === activeRequestIdRef.current) {
          setIsStreaming(false);
          activeControllerRef.current = null;
        }

        interruptedRequestIdsRef.current.delete(requestId);
      };

      const markStreamComplete = () => {
        isRequestComplete = true;
        if (requestId === activeRequestIdRef.current) {
          const tools = extractToolNamesFromTimeline(usePlaygroundStore.getState().timelineEvents);
          if (tools.length > 0) {
            patchLastAssistantInvocation({ tools });
          }
          completeStreamingContent();
        }
      };

      const useFetchFirst = streamPrompt.length >= CHAT_ASYNC_THRESHOLD_CHARS;

      if (useFetchFirst) {
        const response = await fetch(apiUrl('/api/chat-stream'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${streamAuthToken}`,
          },
          body: requestBody,
          signal: controller.signal,
        });

        if (response.status === 202) {
          const accepted = await response.json() as ChatAsyncAccepted;
          try {
            isRequestComplete = await consumeAiTaskEventsSse({
              accepted,
              authToken: streamAuthToken,
              signal: controller.signal,
              handlers: {
                shouldContinue: () => requestId === activeRequestIdRef.current,
                onContent: (content) => {
                  appendStreamingContent(content);
                },
                onTimeline: (event) => {
                  appendTimelineEvent(event);
                },
                onComplete: markStreamComplete,
                onError: (message) => {
                  throw new Error(message);
                },
              },
            });
          } finally {
            finishIncompleteStream();
          }
          return isRequestComplete;
        }

        if (response.ok) {
          try {
            await consumeChatStreamSseResponse({
              response,
              handlers: {
                shouldContinue: () => requestId === activeRequestIdRef.current,
                onChunk: handleStreamChunk,
              },
            });
          } finally {
            finishIncompleteStream();
          }
          return isRequestComplete;
        }

        throw new Error(`chat stream failed: ${response.status}`);
      }

      await fetchEventSource(apiUrl('/api/chat-stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${streamAuthToken}`,
        },
        body: requestBody,
        signal: controller.signal,
        onmessage(event) {
          try {
            handleStreamChunk(JSON.parse(event.data) as StreamChunk);
          } catch {
            // 忽略畸形 SSE 数据，避免中断整条流。
          }
        },
        onerror(error) {
          if (requestId === activeRequestIdRef.current) {
            abortStreamingAssistantMessage();
          }
          throw error;
        },
        onclose: finishIncompleteStream,
      });
      return isRequestComplete;
    },
    [
      activeControllerRef,
      activeRequestIdRef,
      appendStreamingContent,
      appendTimelineEvent,
      abortStreamingAssistantMessage,
      authToken,
      completeStreamingContent,
      interruptedRequestIdsRef,
      patchLastAssistantInvocation,
      setIsStreaming,
      setMessages,
    ],
  );

  return { executePlaygroundChatStream };
};
