import { useCallback } from 'react';

import { createPlaygroundSessionId } from '../../../store/playgroundStore';
import type { RecentDialogueItem } from '../types';

type UsePlaygroundHistoryActionsParams = {
  sessionId: string;
  publishedChatbotWorkflowAppId: string | null;
  messages: { length: number };
  hasRestorableDraft: boolean;
  streamRefs: {
    activeControllerRef: { current: AbortController | null };
  };
  resetAssistantStreamingState: () => void;
  setIsStreaming: (value: boolean) => void;
  setIsOrchestrating: (value: boolean) => void;
  setIsAwaitingTakeoutFollowup: (value: boolean) => void;
  clearTimelineEvents: () => void;
  switchPlaygroundHistorySession: (routing: {
    basePlaygroundSessionId: string;
    publishedChatbotWorkflowAppId: string | null;
  }) => void;
  resetChatPanelState: () => void;
  setSessionId: (value: string) => void;
  setIsHistoryOpen: (value: boolean) => void;
  setHistorySwitchConfirmTarget: (value: RecentDialogueItem | null) => void;
  historySwitchConfirmTarget: RecentDialogueItem | null;
  refreshRecentSessions: () => Promise<void>;
};

export const usePlaygroundHistoryActions = ({
  sessionId,
  publishedChatbotWorkflowAppId,
  messages,
  hasRestorableDraft,
  streamRefs,
  resetAssistantStreamingState,
  setIsStreaming,
  setIsOrchestrating,
  setIsAwaitingTakeoutFollowup,
  clearTimelineEvents,
  switchPlaygroundHistorySession,
  resetChatPanelState,
  setSessionId,
  setIsHistoryOpen,
  setHistorySwitchConfirmTarget,
  historySwitchConfirmTarget,
  refreshRecentSessions,
}: UsePlaygroundHistoryActionsParams) => {
  const applyHistorySessionSwitch = useCallback(
    (target: RecentDialogueItem) => {
      setIsHistoryOpen(false);
      streamRefs.activeControllerRef.current?.abort();
      streamRefs.activeControllerRef.current = null;
      resetAssistantStreamingState();
      setIsStreaming(false);
      setIsOrchestrating(false);
      setIsAwaitingTakeoutFollowup(false);
      clearTimelineEvents();
      switchPlaygroundHistorySession({
        basePlaygroundSessionId: target.basePlaygroundSessionId,
        publishedChatbotWorkflowAppId: target.publishedChatbotWorkflowAppId,
      });
    },
    [
      clearTimelineEvents,
      resetAssistantStreamingState,
      setIsAwaitingTakeoutFollowup,
      setIsHistoryOpen,
      setIsOrchestrating,
      setIsStreaming,
      streamRefs.activeControllerRef,
      switchPlaygroundHistorySession,
    ],
  );

  const handleStartNewConversation = useCallback(() => {
    setIsHistoryOpen(false);
    setHistorySwitchConfirmTarget(null);

    if (messages.length === 0) {
      if (!hasRestorableDraft) {
        return;
      }

      streamRefs.activeControllerRef.current?.abort();
      streamRefs.activeControllerRef.current = null;
      resetAssistantStreamingState();
      setIsStreaming(false);
      setIsOrchestrating(false);
      setIsAwaitingTakeoutFollowup(false);
      clearTimelineEvents();
      resetChatPanelState();
      return;
    }

    streamRefs.activeControllerRef.current?.abort();
    streamRefs.activeControllerRef.current = null;
    resetAssistantStreamingState();
    setIsStreaming(false);
    setIsOrchestrating(false);
    setIsAwaitingTakeoutFollowup(false);
    clearTimelineEvents();
    setSessionId(createPlaygroundSessionId());
    void refreshRecentSessions();
  }, [
    clearTimelineEvents,
    hasRestorableDraft,
    messages.length,
    refreshRecentSessions,
    resetAssistantStreamingState,
    resetChatPanelState,
    setHistorySwitchConfirmTarget,
    setIsAwaitingTakeoutFollowup,
    setIsHistoryOpen,
    setIsOrchestrating,
    setIsStreaming,
    setSessionId,
    streamRefs.activeControllerRef,
  ]);

  const handleHistoryItemClick = useCallback(
    (target: RecentDialogueItem) => {
      const sameRouting =
        target.basePlaygroundSessionId === sessionId &&
        (target.publishedChatbotWorkflowAppId ?? null) === (publishedChatbotWorkflowAppId ?? null);
      if (sameRouting) {
        setIsHistoryOpen(false);
        return;
      }

      if (hasRestorableDraft) {
        setHistorySwitchConfirmTarget(target);
        return;
      }

      applyHistorySessionSwitch(target);
    },
    [applyHistorySessionSwitch, hasRestorableDraft, publishedChatbotWorkflowAppId, sessionId, setHistorySwitchConfirmTarget, setIsHistoryOpen],
  );

  const cancelHistorySessionSwitch = useCallback(() => {
    setIsHistoryOpen(true);
    setHistorySwitchConfirmTarget(null);
  }, [setHistorySwitchConfirmTarget, setIsHistoryOpen]);

  const confirmHistorySessionSwitch = useCallback(() => {
    if (!historySwitchConfirmTarget) {
      return;
    }

    applyHistorySessionSwitch(historySwitchConfirmTarget);
    setHistorySwitchConfirmTarget(null);
  }, [applyHistorySessionSwitch, historySwitchConfirmTarget, setHistorySwitchConfirmTarget]);

  return {
    applyHistorySessionSwitch,
    cancelHistorySessionSwitch,
    confirmHistorySessionSwitch,
    handleHistoryItemClick,
    handleStartNewConversation,
  };
};
