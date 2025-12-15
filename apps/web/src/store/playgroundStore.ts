import type { SetStateAction } from 'react';
import { create } from 'zustand';
import type { FileSelectionResult } from '../features/agent-tools/file';
import {
  createInitialTakeoutFlowState,
  type ImageSelectionResult,
  type LocalChatMessage,
  type MemoryLiveMetrics,
  type TakeoutFlowState,
} from '../features/chat-stream/storeTypes';
import type { TimelineEvent } from '../types/chat';

const SESSION_STORAGE_KEY = 'kronos_session_id';
const PUBLISHED_CHATBOT_WORKFLOW_APP_ID_KEY = 'kronos_playground_published_chatbot_app_id';

const readPublishedChatbotWorkflowAppId = (): string | null => {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  const raw = sessionStorage.getItem(PUBLISHED_CHATBOT_WORKFLOW_APP_ID_KEY);
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const writePublishedChatbotWorkflowAppId = (value: string | null): void => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  if (value && value.trim().length > 0) {
    sessionStorage.setItem(PUBLISHED_CHATBOT_WORKFLOW_APP_ID_KEY, value.trim());
  } else {
    sessionStorage.removeItem(PUBLISHED_CHATBOT_WORKFLOW_APP_ID_KEY);
  }
};

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

/**
 * 从 sessionStorage 读取已有 sessionId，若不存在则生成新的并写入。
 * 这样当前页刷新仍保留会话，但关闭页面后再次进入会开启新会话。
 */
const _getOrCreateSessionId = (): string => {
  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem(SESSION_STORAGE_KEY, newId);
  return newId;
};

type PlaygroundState = {
  temperature: number;
  topP: number;
  sessionId: string;
  authToken: string;
  latestUserQuestion: string;
  /** 首页对话选用的已发布 Chatbot 工作流应用 id（本地 sessionStorage） */
  publishedChatbotWorkflowAppId: string | null;
  timelineEvents: TimelineEvent[];
  chatMessages: LocalChatMessage[];
  chatPrompt: string;
  pendingFile: FileSelectionResult | null;
  pendingImage: ImageSelectionResult | null;
  isStreaming: boolean;
  isOrchestrating: boolean;
  isAnalyzingImage: boolean;
  isAwaitingTakeoutFollowup: boolean;
  memoryMetrics: MemoryLiveMetrics;
  memorySummary: string;
  memorySummaryUpdatedAt: number | null;
  takeoutFlowState: TakeoutFlowState;
  setTemperature: (value: number) => void;
  setTopP: (value: number) => void;
  setSessionId: (value: string) => void;
  setAuthToken: (value: string) => void;
  setLatestUserQuestion: (value: string) => void;
  setPublishedChatbotWorkflowAppId: (value: string | null) => void;
  /** 历史对话切换：原子更新页签 session 与已发布应用选择，避免中间态错连快照 */
  switchPlaygroundHistorySession: (routing: {
    basePlaygroundSessionId: string;
    publishedChatbotWorkflowAppId: string | null;
  }) => void;
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

export const usePlaygroundStore = create<PlaygroundState>((set) => ({
  temperature: 0.7,
  topP: 0.9,
  sessionId: _getOrCreateSessionId(),
  authToken: '',
  latestUserQuestion: '',
  publishedChatbotWorkflowAppId: readPublishedChatbotWorkflowAppId(),
  timelineEvents: [],
  ...createInitialChatPanelState(),
  setTemperature: (value) => set({ temperature: value }),
  setTopP: (value) => set({ topP: value }),
  setSessionId: (value) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, value);
    set({ sessionId: value, timelineEvents: [], ...createInitialChatPanelState() });
  },
  setAuthToken: (value) => set({ authToken: value }),
  setLatestUserQuestion: (value) => set({ latestUserQuestion: value }),
  setPublishedChatbotWorkflowAppId: (value) => {
    writePublishedChatbotWorkflowAppId(value);
    set({ publishedChatbotWorkflowAppId: value });
  },
  switchPlaygroundHistorySession: ({ basePlaygroundSessionId, publishedChatbotWorkflowAppId }) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, basePlaygroundSessionId);
    writePublishedChatbotWorkflowAppId(publishedChatbotWorkflowAppId);
    set({
      sessionId: basePlaygroundSessionId,
      publishedChatbotWorkflowAppId,
      timelineEvents: [],
      ...createInitialChatPanelState(),
    });
  },
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
}));
