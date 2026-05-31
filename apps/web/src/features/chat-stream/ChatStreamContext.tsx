import { createContext, useContext } from 'react';
import type { UseChatStreamControllerResult } from './hooks/useChatStreamController';

const ChatStreamContext = createContext<UseChatStreamControllerResult | null>(null);

export const ChatStreamProvider = ChatStreamContext.Provider;

export const useChatStreamContext = (): UseChatStreamControllerResult => {
  const ctx = useContext(ChatStreamContext);
  if (!ctx) {
    throw new Error('useChatStreamContext must be used within ChatStreamProvider');
  }
  return ctx;
};
