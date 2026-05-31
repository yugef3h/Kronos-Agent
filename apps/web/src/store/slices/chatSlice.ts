import type { SetStateAction } from 'react';
import type { StateCreator } from 'zustand';
import type { FileSelectionResult } from '../../features/agent-tools/file';
import type { ImageSelectionResult } from '../../features/agent-tools/image';
import {
  createInitialTakeoutFlowState,
  type LocalChatMessage,
  type MemoryLiveMetrics,
  type TakeoutFlowState,
} from '../../features/chat-stream/storeTypes';
import type { TimelineEvent } from '../../types/chat';

const applyStateAction = <T>(currentValue: T, nextValue: SetStateAction<T>): T => {
  return typeof nextValue === 'function'
    ? (nextValue as (previousValue: T) => T)(currentValue)
    : nextValue;
};

export const createInitialMemoryMetrics = (): MemoryLiveMetrics => ({
  messageCount: 0,
  conversationTokensEstimate: 0,
  summaryTokensEstimate: 0,
  budgetTokensEstimate: 0,
  summaryTriggerMessageCount: 12,
  isSummaryThresholdReached: false,
});

export const createInitialChatPanelState = () => ({
  chatMessages: [] as LocalChatMessage[],
  chatPrompt: '',
  pendingFile: null as FileSelectionResult | null,
  pendingImage: null as ImageSelectionResult | null,
  isStreaming: false,
  isOrchestrating: false,
  isAnalyzingImage: false,
  isAwaitingTakeoutFollowup: false,
  memoryMetrics: createInitialMemoryMetrics(),
  memorySummary: '',
  memorySummaryUpdatedAt: null as number | null,
  takeoutFlowState: createInitialTakeoutFlowState(),
});

export type ChatSlice = ReturnType<typeof createInitialChatPanelState> & {
  timelineEvents: TimelineEvent[];
  appendTimelineEvent: (value: TimelineEvent) => void;
  clearTimelineEvents: () => void;
  setChatMessages: (value: SetStateAction<LocalChatMessage[]>) => void;
  setChatPrompt: (value: SetStateAction<string>) => void;
  setPendingFile: (value: SetStateAction<FileSelectionResult | null>) => void;
  setPendingImage: (value: SetStateAction<ImageSelectionResult | null>) => void;
  setIsStreaming: (value: SetStateAction<boolean>) => void;
  setIsOrchestrating: (value: SetStateAction<boolean>) => void;
  setIsAnalyzingImage: (value: SetStateAction<boolean>) => void;
  setIsAwaitingTakeoutFollowup: (value: SetStateAction<boolean>) => void;
  setMemoryMetrics: (value: SetStateAction<MemoryLiveMetrics>) => void;
  setMemorySummary: (value: SetStateAction<string>) => void;
  setMemorySummaryUpdatedAt: (value: SetStateAction<number | null>) => void;
  setTakeoutFlowState: (value: SetStateAction<TakeoutFlowState>) => void;
  resetChatPanelState: () => void;
};

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set) => ({
  ...createInitialChatPanelState(),
  timelineEvents: [],

  appendTimelineEvent: (value) => set((state) => ({ timelineEvents: [...state.timelineEvents, value] })),
  clearTimelineEvents: () => set({ timelineEvents: [] }),
  setChatMessages: (value) => set((state) => ({ chatMessages: applyStateAction(state.chatMessages, value) })),
  setChatPrompt: (value) => set((state) => ({ chatPrompt: applyStateAction(state.chatPrompt, value) })),
  setPendingFile: (value) => set((state) => ({ pendingFile: applyStateAction(state.pendingFile, value) })),
  setPendingImage: (value) => set((state) => ({ pendingImage: applyStateAction(state.pendingImage, value) })),
  setIsStreaming: (value) => set((state) => ({ isStreaming: applyStateAction(state.isStreaming, value) })),
  setIsOrchestrating: (value) => set((state) => ({ isOrchestrating: applyStateAction(state.isOrchestrating, value) })),
  setIsAnalyzingImage: (value) => set((state) => ({ isAnalyzingImage: applyStateAction(state.isAnalyzingImage, value) })),
  setIsAwaitingTakeoutFollowup: (value) => set((state) => ({
    isAwaitingTakeoutFollowup: applyStateAction(state.isAwaitingTakeoutFollowup, value),
  })),
  setMemoryMetrics: (value) => set((state) => ({ memoryMetrics: applyStateAction(state.memoryMetrics, value) })),
  setMemorySummary: (value) => set((state) => ({ memorySummary: applyStateAction(state.memorySummary, value) })),
  setMemorySummaryUpdatedAt: (value) =>
    set((state) => ({ memorySummaryUpdatedAt: applyStateAction(state.memorySummaryUpdatedAt, value) })),
  setTakeoutFlowState: (value) => set((state) => ({ takeoutFlowState: applyStateAction(state.takeoutFlowState, value) })),
  resetChatPanelState: () => set(createInitialChatPanelState()),
});
