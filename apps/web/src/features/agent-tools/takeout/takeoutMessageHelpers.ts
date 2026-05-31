import { useCallback } from 'react';
import { createAssistantInvocation } from '../../chat-stream/assistantInvocation';
import { withClientMessageId } from '../../chat-stream/utils/chatStreamHelpers';
import { requestAppendSessionMessages } from '../../../lib/api';
import type {
  TakeoutChatMessage,
  TakeoutMessageType,
  TakeoutMessageUpdater,
} from './types';

type TakeoutAssistantMessageOptions = {
  flowType?: 'takeout';
  flowId?: number;
  takeoutMessageType?: TakeoutMessageType;
};

export const useTakeoutMessageHelpers = (
  setMessages: TakeoutMessageUpdater,
  authToken: string,
  sessionId: string,
) => {
  const appendAssistantTextMessage = useCallback(
    (content: string, options?: TakeoutAssistantMessageOptions) => {
      const assistantInvocation = options?.flowType === 'takeout'
        ? createAssistantInvocation({ modalities: ['takeout'] })
        : undefined;

      setMessages((prev) => [
        ...prev,
        withClientMessageId({
          role: 'assistant',
          content,
          isIncomplete: false,
          flowType: options?.flowType,
          flowId: options?.flowId,
          takeoutMessageType: options?.takeoutMessageType,
          assistantInvocation,
        }),
      ]);
    },
    [setMessages],
  );

  const appendTakeoutCardMessage = useCallback(
    (flowId: number, takeoutMessageType: TakeoutMessageType) => {
      setMessages((prev) => [
        ...prev,
        withClientMessageId({
          role: 'assistant',
          content: '',
          flowType: 'takeout',
          takeoutMessageType,
          flowId,
          assistantInvocation: createAssistantInvocation({ modalities: ['takeout'] }),
        }),
      ]);
    },
    [setMessages],
  );

  const appendTakeoutFallbackMessage = useCallback(
    (flowId: number, message = '外卖服务暂时不可用，请稍后再试。') => {
      appendAssistantTextMessage(message, { flowType: 'takeout', flowId });
    },
    [appendAssistantTextMessage],
  );

  const appendTakeoutSessionMessages = useCallback(async (params: {
    userContent?: string;
    assistantContent?: string;
  }) => {
    if (!authToken) return;

    const payload = [
      params.userContent ? { role: 'user' as const, content: params.userContent } : null,
      params.assistantContent ? { role: 'assistant' as const, content: params.assistantContent } : null,
    ].filter((item): item is { role: 'user' | 'assistant'; content: string } => item !== null);

    if (payload.length === 0) return;

    try {
      await requestAppendSessionMessages({ authToken, sessionId, messages: payload });
    } catch {
      // 本地 UI 可继续，历史写入失败不阻塞当前流程。
    }
  }, [authToken, sessionId]);

  return {
    appendAssistantTextMessage,
    appendTakeoutCardMessage,
    appendTakeoutFallbackMessage,
    appendTakeoutSessionMessages,
  };
};
