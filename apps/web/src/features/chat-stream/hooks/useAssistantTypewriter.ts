import { useCallback, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { STREAM_TYPEWRITER_DELAY_MS } from '../constants';
import type { AssistantTypewriterOptions, LocalChatMessage } from '../types';

type UseAssistantTypewriterParams = {
  setMessages: Dispatch<SetStateAction<LocalChatMessage[]>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  activeControllerRef: MutableRefObject<AbortController | null>;
};

export const useAssistantTypewriter = ({
  setMessages,
  setIsStreaming,
  activeControllerRef,
}: UseAssistantTypewriterParams) => {
  const streamPendingCharsRef = useRef<string[]>([]);
  const streamFlushTimerRef = useRef<number | null>(null);
  const streamHasCompletedRef = useRef(false);
  const streamCompletionCallbackRef = useRef<(() => void) | null>(null);

  const stopStreamFlushTimer = useCallback(() => {
    if (streamFlushTimerRef.current !== null) {
      window.clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
  }, []);

  const finalizeStreamingAssistantMessage = useCallback(() => {
    setMessages((prev) => {
      const draft = [...prev];
      const last = draft[draft.length - 1];

      if (!last || last.role !== 'assistant') {
        return draft;
      }

      draft[draft.length - 1] = {
        ...last,
        isStreamingText: false,
      };

      return draft;
    });
  }, [setMessages]);

  const flushRemainingAssistantBuffer = useCallback(() => {
    if (streamPendingCharsRef.current.length === 0) {
      return;
    }

    const pendingText = streamPendingCharsRef.current.join('');
    streamPendingCharsRef.current = [];

    setMessages((prev) => {
      const draft = [...prev];
      const last = draft[draft.length - 1];

      if (!last || last.role !== 'assistant') {
        return draft;
      }

      draft[draft.length - 1] = {
        ...last,
        content: `${last.content}${pendingText}`,
        isStreamingText: !streamHasCompletedRef.current,
        isIncomplete: false,
      };

      return draft;
    });
  }, [setMessages]);

  const resetAssistantStreamingState = useCallback(() => {
    stopStreamFlushTimer();
    streamPendingCharsRef.current = [];
    streamHasCompletedRef.current = false;
    streamCompletionCallbackRef.current = null;
  }, [stopStreamFlushTimer]);

  const drainAssistantBuffer = useCallback(() => {
    if (streamPendingCharsRef.current.length === 0) {
      stopStreamFlushTimer();

      if (streamHasCompletedRef.current) {
        const onComplete = streamCompletionCallbackRef.current;
        finalizeStreamingAssistantMessage();
        setIsStreaming(false);
        activeControllerRef.current = null;
        resetAssistantStreamingState();
        onComplete?.();
      }

      return;
    }

    const nextChar = streamPendingCharsRef.current.shift();

    if (!nextChar) {
      stopStreamFlushTimer();
      return;
    }

    setMessages((prev) => {
      const draft = [...prev];
      const last = draft[draft.length - 1];

      if (!last || last.role !== 'assistant') {
        return draft;
      }

      draft[draft.length - 1] = {
        ...last,
        content: `${last.content}${nextChar}`,
        isStreamingText: true,
        isIncomplete: false,
      };

      return draft;
    });

    streamFlushTimerRef.current = window.setTimeout(drainAssistantBuffer, STREAM_TYPEWRITER_DELAY_MS);
  }, [activeControllerRef, finalizeStreamingAssistantMessage, resetAssistantStreamingState, setIsStreaming, setMessages, stopStreamFlushTimer]);

  const scheduleAssistantBufferDrain = useCallback(() => {
    if (streamFlushTimerRef.current !== null) {
      return;
    }

    drainAssistantBuffer();
  }, [drainAssistantBuffer]);

  const startAssistantTypewriter = useCallback((
    content: string,
    options?: AssistantTypewriterOptions,
  ) => {
    resetAssistantStreamingState();
    streamHasCompletedRef.current = true;
    streamCompletionCallbackRef.current = options?.onComplete || null;
    streamPendingCharsRef.current = Array.from(content);
    setIsStreaming(true);

    setMessages((prev) => {
      const draft = [...prev];

      if (options?.replaceLastAssistant) {
        const last = draft[draft.length - 1];

        if (last && last.role === 'assistant') {
          draft[draft.length - 1] = {
            ...last,
            content: '',
            isIncomplete: false,
            isStreamingText: true,
          };

          return draft;
        }
      }

      return [
        ...draft,
        { role: 'assistant', content: '', isIncomplete: false, isStreamingText: true },
      ];
    });

    scheduleAssistantBufferDrain();
  }, [resetAssistantStreamingState, scheduleAssistantBufferDrain, setIsStreaming, setMessages]);

  const startStreamingAssistantMessage = useCallback(() => {
    resetAssistantStreamingState();
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', isStreamingText: true, isIncomplete: false },
    ]);
    setIsStreaming(true);
  }, [resetAssistantStreamingState, setIsStreaming, setMessages]);

  const appendStreamingContent = useCallback((content: string) => {
    streamPendingCharsRef.current.push(...Array.from(content));
    scheduleAssistantBufferDrain();
  }, [scheduleAssistantBufferDrain]);

  const completeStreamingContent = useCallback(() => {
    streamHasCompletedRef.current = true;

    if (streamPendingCharsRef.current.length === 0 && streamFlushTimerRef.current === null) {
      finalizeStreamingAssistantMessage();
      setIsStreaming(false);
      activeControllerRef.current = null;
      resetAssistantStreamingState();
    }
  }, [activeControllerRef, finalizeStreamingAssistantMessage, resetAssistantStreamingState, setIsStreaming]);

  const abortStreamingAssistantMessage = useCallback(() => {
    flushRemainingAssistantBuffer();
    finalizeStreamingAssistantMessage();
    resetAssistantStreamingState();
    setIsStreaming(false);
    activeControllerRef.current = null;
  }, [activeControllerRef, finalizeStreamingAssistantMessage, flushRemainingAssistantBuffer, resetAssistantStreamingState, setIsStreaming]);

  return {
    streamFlushTimerRef,
    resetAssistantStreamingState,
    flushRemainingAssistantBuffer,
    startAssistantTypewriter,
    startStreamingAssistantMessage,
    appendStreamingContent,
    completeStreamingContent,
    abortStreamingAssistantMessage,
  };
};