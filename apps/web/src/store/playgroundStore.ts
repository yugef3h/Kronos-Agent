import { create } from 'zustand';
import type { TimelineEvent } from '../types/chat';

const SESSION_STORAGE_KEY = 'kronos_session_id';

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
  timelineEvents: TimelineEvent[];
  setTemperature: (value: number) => void;
  setTopP: (value: number) => void;
  setSessionId: (value: string) => void;
  setAuthToken: (value: string) => void;
  setLatestUserQuestion: (value: string) => void;
  appendTimelineEvent: (value: TimelineEvent) => void;
  clearTimelineEvents: () => void;
};

export const usePlaygroundStore = create<PlaygroundState>((set) => ({
  temperature: 0.7,
  topP: 0.9,
  sessionId: _getOrCreateSessionId(),
  authToken: '',
  latestUserQuestion: '',
  timelineEvents: [],
  setTemperature: (value) => set({ temperature: value }),
  setTopP: (value) => set({ topP: value }),
  setSessionId: (value) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, value);
    set({ sessionId: value, timelineEvents: [] });
  },
  setAuthToken: (value) => set({ authToken: value }),
  setLatestUserQuestion: (value) => set({ latestUserQuestion: value }),
  appendTimelineEvent: (value) => set((state) => ({ timelineEvents: [...state.timelineEvents, value] })),
  clearTimelineEvents: () => set({ timelineEvents: [] }),
}));
