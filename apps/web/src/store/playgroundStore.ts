import { create } from 'zustand';

type PlaygroundState = {
  temperature: number;
  topP: number;
  sessionId: string;
  setTemperature: (value: number) => void;
  setTopP: (value: number) => void;
};

export const usePlaygroundStore = create<PlaygroundState>((set) => ({
  temperature: 0.7,
  topP: 0.9,
  sessionId: `${Date.now()}`,
  setTemperature: (value) => set({ temperature: value }),
  setTopP: (value) => set({ topP: value }),
}));
