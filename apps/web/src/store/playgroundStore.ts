import { create } from 'zustand';
import { createChatSlice, type ChatSlice } from './slices/chatSlice';
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice';

export type PlaygroundState = SessionSlice & ChatSlice;

export const usePlaygroundStore = create<PlaygroundState>()((...args) => ({
  ...createSessionSlice(...args),
  ...createChatSlice(...args),
}));

// Re-export utilities for backward compatibility
export { createInitialMemoryMetrics, createInitialChatPanelState } from './slices/chatSlice';
export { createPlaygroundSessionId } from './slices/sessionSlice';
