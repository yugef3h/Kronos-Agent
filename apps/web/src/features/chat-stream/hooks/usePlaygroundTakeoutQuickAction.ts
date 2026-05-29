import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

import { createAssistantInvocation } from '../assistantInvocation';
import { TAKEOUT_QUICK_ACTION_REPLY, TAKEOUT_QUICK_ACTION_REPLY_DELAY_MS } from '../constants';
import type { LocalChatMessage, PromptQuickAction } from '../types';
import { getTakeoutQuickActionPrompt } from '../../agent-tools/takeout';
import { withClientMessageId } from '../utils/chatStreamHelpers';

type UsePlaygroundTakeoutQuickActionParams = {
  prompt: string;
  isStreaming: boolean;
  isOrchestrating: boolean;
  isAnalyzingImage: boolean;
  fileInputRef: { current: HTMLInputElement | null };
  imageInputRef: { current: HTMLInputElement | null };
  setMessages: Dispatch<SetStateAction<LocalChatMessage[]>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  setLatestUserQuestion: (value: string) => void;
  setIsAwaitingTakeoutFollowup: (value: boolean) => void;
  startAssistantTypewriter: (
    content: string,
    options?: {
      replaceLastAssistant?: boolean;
      assistantInvocation?: LocalChatMessage['assistantInvocation'];
      onComplete?: () => void;
    },
  ) => void;
  scheduleMemoryMetricsRefresh: () => void;
};

export const usePlaygroundTakeoutQuickAction = ({
  prompt,
  isStreaming,
  isOrchestrating,
  isAnalyzingImage,
  fileInputRef,
  imageInputRef,
  setMessages,
  setPrompt,
  setLatestUserQuestion,
  setIsAwaitingTakeoutFollowup,
  startAssistantTypewriter,
  scheduleMemoryMetricsRefresh,
}: UsePlaygroundTakeoutQuickActionParams) => {
  const takeoutQuickReplyTimerRef = useRef<number | null>(null);

  const handleQuickActionClick = useCallback((action: PromptQuickAction['key']) => {
    if (action === 'takeout') {
      if (isStreaming || isOrchestrating || isAnalyzingImage || takeoutQuickReplyTimerRef.current !== null) {
        return;
      }

      const takeoutPrompt = getTakeoutQuickActionPrompt(prompt);
      const takeoutInvocation = createAssistantInvocation({ modalities: ['takeout'] });
      setMessages((prev) => [
        ...prev,
        withClientMessageId({ role: 'user', content: takeoutPrompt, isIncomplete: false }),
        withClientMessageId({
          role: 'assistant',
          content: '',
          isIncomplete: false,
          assistantInvocation: takeoutInvocation,
        }),
      ]);
      setPrompt('');
      setLatestUserQuestion(takeoutPrompt);

      takeoutQuickReplyTimerRef.current = window.setTimeout(() => {
        startAssistantTypewriter(TAKEOUT_QUICK_ACTION_REPLY, {
          replaceLastAssistant: true,
          assistantInvocation: takeoutInvocation,
          onComplete: () => {
            setIsAwaitingTakeoutFollowup(true);
            scheduleMemoryMetricsRefresh();
          },
        });

        takeoutQuickReplyTimerRef.current = null;
      }, TAKEOUT_QUICK_ACTION_REPLY_DELAY_MS);
      return;
    }

    if (action === 'file') {
      if (isStreaming || isOrchestrating || isAnalyzingImage) {
        return;
      }

      fileInputRef.current?.click();
      return;
    }

    if (action === 'image') {
      if (isStreaming || isOrchestrating || isAnalyzingImage) {
        return;
      }

      imageInputRef.current?.click();
      return;
    }

    if (action === 'translate') {
      setPrompt((prev) => `${prev}${prev ? ' ' : ''}/translate `);
    }
  }, [
    fileInputRef,
    imageInputRef,
    isAnalyzingImage,
    isOrchestrating,
    isStreaming,
    prompt,
    scheduleMemoryMetricsRefresh,
    setIsAwaitingTakeoutFollowup,
    setLatestUserQuestion,
    setMessages,
    setPrompt,
    startAssistantTypewriter,
  ]);

  return {
    handleQuickActionClick,
    takeoutQuickReplyTimerRef,
  };
};
