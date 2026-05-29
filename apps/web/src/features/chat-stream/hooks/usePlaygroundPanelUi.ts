import {
  Fragment,
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';

import { MOCK_ADDRESS } from '../../agent-tools/takeout';
import { MESSAGE_LIST_STICK_THRESHOLD_PX } from '../constants';
import type { LocalChatMessage } from '../types';

const PROMPT_MAX_HEIGHT = 300;

type UsePlaygroundPanelUiParams = {
  messages: LocalChatMessage[];
  prompt: string;
};

export const usePlaygroundPanelUi = ({ messages, prompt }: UsePlaygroundPanelUiParams) => {
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const updateMessageListScrollPin = useCallback(() => {
    const element = messageListRef.current;
    if (!element) {
      return;
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= MESSAGE_LIST_STICK_THRESHOLD_PX;
    setShowScrollToBottom(distanceFromBottom > MESSAGE_LIST_STICK_THRESHOLD_PX);
  }, []);

  const scrollToBottom = useCallback(() => {
    const element = messageListRef.current;
    if (!element) {
      return;
    }

    stickToBottomRef.current = true;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    setShowScrollToBottom(false);
  }, []);

  const adjustPromptTextareaHeight = useCallback(() => {
    const textarea = promptTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, PROMPT_MAX_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > PROMPT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    const element = messageListRef.current;
    if (!element || !stickToBottomRef.current) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    adjustPromptTextareaHeight();
  }, [adjustPromptTextareaHeight, prompt]);

  useEffect(() => {
    const element = messageListRef.current;
    if (!element) {
      return undefined;
    }

    updateMessageListScrollPin();
    element.addEventListener('scroll', updateMessageListScrollPin, { passive: true });
    return () => element.removeEventListener('scroll', updateMessageListScrollPin);
  }, [updateMessageListScrollPin]);

  const renderPlainMessageContent = useCallback((message: LocalChatMessage): ReactNode => {
    const suffix = message.isIncomplete ? '...' : '';
    const content = message.content || '';
    const cursor = message.role === 'assistant' && message.isStreamingText
      ? createElement('span', { className: 'ml-0.5 inline-block animate-pulse text-cyan-500' }, '|')
      : null;

    if (!content) {
      return '...';
    }

    if (message.role !== 'assistant' || !content.includes(MOCK_ADDRESS)) {
      return createElement(Fragment, null, content, suffix, cursor);
    }

    const [prefix, ...rest] = content.split(MOCK_ADDRESS);
    return createElement(
      Fragment,
      null,
      prefix,
      createElement('span', { className: 'text-blue-500' }, MOCK_ADDRESS),
      rest.join(MOCK_ADDRESS),
      suffix,
      cursor,
    );
  }, []);

  return {
    messageListRef,
    promptTextareaRef,
    renderPlainMessageContent,
    scrollToBottom,
    showScrollToBottom,
    stickToBottomRef,
  };
};

export type PlaygroundStickToBottomRef = MutableRefObject<boolean>;
