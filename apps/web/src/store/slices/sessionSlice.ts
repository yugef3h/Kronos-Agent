import type { StateCreator } from 'zustand';
import { createInitialChatPanelState, type ChatSlice } from './chatSlice';

const SESSION_STORAGE_KEY = 'kronos_session_id';
const PUBLISHED_CHATBOT_WORKFLOW_APP_ID_KEY = 'kronos_playground_published_chatbot_app_id';

const readPublishedChatbotWorkflowAppId = (): string | null => {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(PUBLISHED_CHATBOT_WORKFLOW_APP_ID_KEY);
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const writePublishedChatbotWorkflowAppId = (value: string | null): void => {
  if (typeof sessionStorage === 'undefined') return;
  if (value && value.trim().length > 0) {
    sessionStorage.setItem(PUBLISHED_CHATBOT_WORKFLOW_APP_ID_KEY, value.trim());
  } else {
    sessionStorage.removeItem(PUBLISHED_CHATBOT_WORKFLOW_APP_ID_KEY);
  }
};

export const createPlaygroundSessionId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getOrCreateSessionId = (): string => {
  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const newId = createPlaygroundSessionId();
  sessionStorage.setItem(SESSION_STORAGE_KEY, newId);
  return newId;
};

export type SessionSlice = {
  temperature: number;
  topP: number;
  sessionId: string;
  authToken: string;
  latestUserQuestion: string;
  publishedChatbotWorkflowAppId: string | null;
  setTemperature: (value: number) => void;
  setTopP: (value: number) => void;
  setSessionId: (value: string) => void;
  setAuthToken: (value: string) => void;
  setLatestUserQuestion: (value: string) => void;
  setPublishedChatbotWorkflowAppId: (value: string | null) => void;
  switchPlaygroundHistorySession: (routing: {
    basePlaygroundSessionId: string;
    publishedChatbotWorkflowAppId: string | null;
  }) => void;
};

export const createSessionSlice: StateCreator<SessionSlice & ChatSlice, [], [], SessionSlice> = (set) => ({
  temperature: 0.7,
  topP: 0.9,
  sessionId: getOrCreateSessionId(),
  authToken: '',
  latestUserQuestion: '',
  publishedChatbotWorkflowAppId: readPublishedChatbotWorkflowAppId(),

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
});
