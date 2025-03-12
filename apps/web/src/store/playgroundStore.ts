import { create } from 'zustand';
import type { TimelineEvent } from '../types/chat';

type PlaygroundState = {
  temperature: number;
  topP: number;
  sessionId: string;
  authToken: string;
  timelineEvents: TimelineEvent[];
  setTemperature: (value: number) => void;
  setTopP: (value: number) => void;
  setAuthToken: (value: string) => void;
  appendTimelineEvent: (value: TimelineEvent) => void;
  clearTimelineEvents: () => void;
};

export const usePlaygroundStore = create<PlaygroundState>((set) => ({
  temperature: 0.7,
  topP: 0.9,
  sessionId: `${Date.now()}`,
  authToken: '',
  timelineEvents: [],
  setTemperature: (value) => set({ temperature: value }),
  setTopP: (value) => set({ topP: value }),
  setAuthToken: (value) => set({ authToken: value }),
  appendTimelineEvent: (value) => set((state) => ({ timelineEvents: [...state.timelineEvents, value] })),
  clearTimelineEvents: () => set({ timelineEvents: [] }),
}));
