import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { apiUrl, requestDevToken, requestRecentSessions, requestSessionSnapshot } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';
import type { ChatMessage, StreamChunk, TimelineEvent } from '../types/chat';

const MAX_CONTEXT_TOKENS = 8192;

type TokenizerModule = {
  encode: (text: string) => Iterable<number>;
};

let tokenizerModulePromise: Promise<TokenizerModule> | null = null;

const getTokenizerModule = (): Promise<TokenizerModule> => {
  if (!tokenizerModulePromise) {
    tokenizerModulePromise = import('gpt-tokenizer').then((module) => ({
      encode: module.encode,
    }));
  }

  return tokenizerModulePromise;
};

const countTextTokens = async (text: string): Promise<number> => {
  const content = text.trim();
  if (!content) {
    return 0;
  }

  const tokenizer = await getTokenizerModule();
  return Array.from(tokenizer.encode(content)).length;
};

type MemoryLiveMetrics = {
  messageCount: number;
  conversationTokensEstimate: number;
  summaryTokensEstimate: number;
  budgetTokensEstimate: number;
  summaryTriggerMessageCount: number;
  isSummaryThresholdReached: boolean;
};

type RecentDialogueItem = {
  id: string;
  sessionId: string;
  updatedAt: number;
  userContent: string;
};

type PromptQuickAction = {
  key: 'file' | 'image' | 'translate' | 'takeout';
  label: string;
};

type LocalChatMessage = ChatMessage & {
  isIncomplete?: boolean;
};

const markLastAssistantMessageIncomplete = (
  chatMessages: LocalChatMessage[],
): LocalChatMessage[] => {
  const draft = [...chatMessages];
  const lastMessage = draft[draft.length - 1];

  if (!lastMessage || lastMessage.role !== 'assistant') {
    return draft;
  }

  draft[draft.length - 1] = {
    ...lastMessage,
    isIncomplete: true,
  };

  return draft;
};

const getLatestUserQuestion = (chatMessages: ChatMessage[]): string => {
  for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
    const message = chatMessages[index];
    if (message.role === 'user' && message.content.trim()) {
      return message.content;
    }
  }

  return '';
};

const buildConversationText = (chatMessages: ChatMessage[]): string => {
  return chatMessages
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');
};

export const ChatStreamPanel = () => {
  const PROMPT_MAX_HEIGHT = 300;
  const promptQuickActions: PromptQuickAction[] = [
    { key: 'takeout', label: '外卖' },
    { key: 'file', label: '文件' },
    { key: 'image', label: '图像' },
    { key: 'translate', label: '翻译' },
  ];
  const {
    sessionId,
    authToken,
    timelineEvents,
    setAuthToken,
    setLatestUserQuestion,
    appendTimelineEvent,
    clearTimelineEvents,
  } = usePlaygroundStore();
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [, setIsGeneratingToken] = useState(false);
  const [, setTokenMessage] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [recentDialogues, setRecentDialogues] = useState<RecentDialogueItem[]>([]);
  const [memoryMetrics, setMemoryMetrics] = useState<MemoryLiveMetrics>({
    messageCount: 0,
    conversationTokensEstimate: 0,
    summaryTokensEstimate: 0,
    budgetTokensEstimate: 0,
    summaryTriggerMessageCount: 12,
    isSummaryThresholdReached: false,
  });
  // 防止旧请求回调与新请求并发写入，导致消息重复拼接。
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  // 防止旧请求回调与新请求并发写入，导致消息重复拼接。
  const activeRequestIdRef = useRef(0);
  const interruptedRequestIdsRef = useRef<Set<number>>(new Set());
  const activeControllerRef = useRef<AbortController | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const historyPanelRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = messageListRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
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

  const formatTimestamp = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
  }, []);

  const canSend = useMemo(() => prompt.trim().length > 0, [prompt]);

  const stageLabelMap: Record<TimelineEvent['stage'], string> = {
    plan: '规划',
    tool: '工具',
    reason: '推理',
  };

  const statusLabelMap: Record<TimelineEvent['status'], string> = {
    start: '开始',
    end: '完成',
    info: '信息',
  };

  const currentTimelineEvent = useMemo(
    () => timelineEvents[timelineEvents.length - 1],
    [timelineEvents],
  );

  const latestTimelineEventId = useMemo(() => {
    return timelineEvents.length > 0 ? timelineEvents[timelineEvents.length - 1]?.eventId || 0 : 0;
  }, [timelineEvents]);

  const refreshMemoryMetrics = useCallback(async () => {
    if (!authToken) {
      return;
    }

    try {
      const snapshot = await requestSessionSnapshot({ sessionId, authToken });
      const [conversationTokens, summaryTokens] = await Promise.all([
        countTextTokens(buildConversationText(snapshot.messages)),
        countTextTokens(snapshot.memorySummary),
      ]);
      const budgetTokens = Math.max(0, MAX_CONTEXT_TOKENS - conversationTokens - summaryTokens);

      setMemoryMetrics({
        ...snapshot.memoryMetrics,
        conversationTokensEstimate: conversationTokens,
        summaryTokensEstimate: summaryTokens,
        budgetTokensEstimate: budgetTokens,
      });
    } catch {
      // 会话指标请求失败时保持当前显示，不中断主对话流。
    }
  }, [authToken, sessionId]);

  const refreshRecentSessions = useCallback(async () => {
    if (!authToken) {
      return;
    }

    setIsHistoryLoading(true);
    try {
      const response = await requestRecentSessions({ authToken, limit: 10 });
      setRecentDialogues(response.items);
    } catch {
      setRecentDialogues([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [authToken]);

  const hydrateSessionMessages = useCallback(async () => {
    if (!authToken) {
      return;
    }

    try {
      const snapshot = await requestSessionSnapshot({ sessionId, authToken });
      const [conversationTokens, summaryTokens] = await Promise.all([
        countTextTokens(buildConversationText(snapshot.messages)),
        countTextTokens(snapshot.memorySummary),
      ]);
      const budgetTokens = Math.max(0, MAX_CONTEXT_TOKENS - conversationTokens - summaryTokens);

      setMessages(snapshot.messages.map((message) => ({ ...message, isIncomplete: false })));
      setLatestUserQuestion(getLatestUserQuestion(snapshot.messages));
      setMemoryMetrics({
        ...snapshot.memoryMetrics,
        conversationTokensEstimate: conversationTokens,
        summaryTokensEstimate: summaryTokens,
        budgetTokensEstimate: budgetTokens,
      });
    } catch {
      // 刷新回显失败时保留当前页状态，不阻断继续提问。
    }
  }, [authToken, sessionId, setLatestUserQuestion]);

  const generateDevToken = useCallback(async () => {
    setIsGeneratingToken(true);
    setTokenMessage('');

    try {
      const data = await requestDevToken();
      setAuthToken(data.token);
      setTokenMessage(`测试 JWT 已自动签发（有效期 ${data.expiresIn}）`);
    } catch {
      setTokenMessage('自动签发失败，请确认 server 已启动且为非生产环境');
    } finally {
      setIsGeneratingToken(false);
    }
  }, [setAuthToken]);

  useEffect(() => {
    if (!authToken) {
      void generateDevToken();
    }
  }, [authToken, generateDevToken]);

  useEffect(() => {
    void hydrateSessionMessages();
  }, [hydrateSessionMessages]);

  useEffect(() => {
    void refreshMemoryMetrics();
  }, [refreshMemoryMetrics, latestTimelineEventId]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshMemoryMetrics();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isStreaming, refreshMemoryMetrics]);

  useEffect(() => {
    const messageListElement = messageListRef.current;
    if (!messageListElement) {
      return;
    }

    messageListElement.scrollTop = messageListElement.scrollHeight;
  }, [messages]);

  useEffect(() => {
    adjustPromptTextareaHeight();
  }, [prompt, adjustPromptTextareaHeight]);

  useEffect(() => {
    if (!isHistoryOpen) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!historyPanelRef.current?.contains(target)) {
        setIsHistoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [isHistoryOpen]);

  // 监听消息列表滚动位置，距底部超过 80px 时显示「滚动到底部」按钮。
  useEffect(() => {
    const el = messageListRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollToBottom(distanceFromBottom > 80);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    return () => {
      activeControllerRef.current?.abort();
    };
  }, []);

  const sendPrompt = async () => {
    if (!canSend) return;

    if (!authToken) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '发送前需要先准备 JWT。' }]);
      return;
    }

    // 发起新请求前先终止旧流，保证同一时刻只有一个有效 SSE 流。
    const previousRequestId = activeRequestIdRef.current;
    if (activeControllerRef.current) {
      interruptedRequestIdsRef.current.add(previousRequestId);
      setMessages((prev) => markLastAssistantMessageIncomplete(prev));
      activeControllerRef.current.abort();
    }

    const requestId = previousRequestId + 1;
    activeRequestIdRef.current = requestId;
    const controller = new AbortController();
    activeControllerRef.current = controller;
    // 某些传输层在重连时会重放事件，按 eventId 去重可避免重复渲染。
    let lastSeenEventId = 0;
    let isRequestComplete = false;
    const userPrompt = prompt.trim();

    clearTimelineEvents();
    setPrompt('');
    setLatestUserQuestion(userPrompt);
    setMessages((prev) => [...prev, { role: 'user', content: userPrompt }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      await fetchEventSource(apiUrl('/api/chat-stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ prompt: userPrompt, sessionId }),
        signal: controller.signal,
        onmessage(event) {
          if (requestId !== activeRequestIdRef.current) {
            return;
          }

          const payload = JSON.parse(event.data) as StreamChunk;

          if (payload.eventId <= lastSeenEventId) {
            return;
          }
          lastSeenEventId = payload.eventId;

          if (payload.type === 'timeline') {
            appendTimelineEvent({
              eventId: payload.eventId,
              stage: payload.stage,
              status: payload.status,
              message: payload.message,
              toolName: payload.toolName,
              toolInput: payload.toolInput,
              toolOutput: payload.toolOutput,
              toolError: payload.toolError,
              timestamp: payload.timestamp,
            });

            if (payload.message.includes('LangChain 流式响应失败')) {
              console.warn(`[ChatStreamPanel] ${payload.message}`);
            }
          }

          if (payload.type === 'content') {
            setMessages((prev) => {
              const draft = [...prev];
              const last = draft[draft.length - 1];
              if (!last || last.role !== 'assistant') return draft;
              return [
                ...draft.slice(0, -1),
                { ...last, content: `${last.content}${payload.content}`, isIncomplete: false },
              ];
            });
          }

          if (payload.type === 'complete') {
            isRequestComplete = true;
            if (requestId === activeRequestIdRef.current) {
              setIsStreaming(false);
              activeControllerRef.current = null;
            }
          }
        },
        onerror(error) {
          if (requestId === activeRequestIdRef.current) {
            setIsStreaming(false);
            activeControllerRef.current = null;
          }
          throw error;
        },
        onclose() {
          if (!isRequestComplete && requestId === activeRequestIdRef.current) {
            setMessages((prev) => markLastAssistantMessageIncomplete(prev));
          }

          if (requestId === activeRequestIdRef.current) {
            setIsStreaming(false);
            activeControllerRef.current = null;
          }

          interruptedRequestIdsRef.current.delete(requestId);
        },
      });
    } catch {
      const isInterruptedRequest = interruptedRequestIdsRef.current.has(requestId) || controller.signal.aborted;

      if (requestId === activeRequestIdRef.current) {
        if (!isRequestComplete) {
          setMessages((prev) => markLastAssistantMessageIncomplete(prev));
        }
        setIsStreaming(false);
        activeControllerRef.current = null;
      }

      interruptedRequestIdsRef.current.delete(requestId);

      if (isInterruptedRequest) {
        return;
      }
    }
  };

  const handlePromptKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey && canSend) {
      event.preventDefault();
      void sendPrompt();
    }
  };

  const toggleHistoryPanel = () => {
    const nextOpen = !isHistoryOpen;
    setIsHistoryOpen(nextOpen);

    if (nextOpen) {
      void refreshRecentSessions();
    }
  };

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_16px_48px_-24px_rgba(14,116,144,0.45)] backdrop-blur md:p-5">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-cyan-100/70 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-100/80 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Agent Runtime</p>
          <h2 className="mt-1 font-display text-xl text-ink">Kronos Chat</h2>
        </div>
        <div ref={historyPanelRef} className="relative">
          <button
            type="button"
            onClick={toggleHistoryPanel}
            className="rounded-xl border border-slate-300/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50"
          >
            历史对话
          </button>
          {isHistoryOpen && (
            <div className="absolute right-0 top-10 z-30 w-[26rem] max-w-[85vw] rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
              <div className="mb-1 px-2 text-xs font-semibold text-slate-600">最近 10 条历史对话</div>
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {isHistoryLoading && <p className="rounded-lg bg-slate-50 px-2 py-2 text-xs text-slate-500">读取中...</p>}
                {!isHistoryLoading && recentDialogues.length === 0 && (
                  <p className="rounded-lg bg-slate-50 px-2 py-2 text-xs text-slate-500">暂无本地缓存对话</p>
                )}
                {!isHistoryLoading && recentDialogues.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 transition hover:border-cyan-200 hover:bg-cyan-50/50">
                    <p className="text-[11px] text-slate-500">{formatTimestamp(item.updatedAt)} | session: {item.sessionId}</p>
                    <div className="mt-1"></div>
                    <p className="line-clamp-1 text-xs text-slate-700" title={item.userContent || '（无用户输入）'}>{item.userContent || '（无用户输入）'}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 justify-center">
          <div
            ref={messageListRef}
            className="h-full w-full max-w-3xl space-y-4 overflow-y-auto rounded-3xl border border-slate-200/85 bg-gradient-to-b from-white via-slate-50/35 to-cyan-50/20 px-3 pb-8 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] md:px-6"
          >
            {messages.length === 0 && (
              <div className="mx-auto mt-8 max-w-xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700/90">Kronos Agent</p>
                <h3 className="mt-2 font-display text-3xl text-slate-800 md:text-4xl">你好，我是 Kronos</h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">我会把回答展示在中间区域，输入框固定在底部。你可以直接提问，右侧栏查看调试细节。</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <article
                  className={`max-w-[80%] rounded-2xl border px-3.5 py-2.5 text-sm shadow-sm md:text-[15px] ${
                    message.role === 'user'
                      ? 'border-cyan-200/90 bg-cyan-50/95 text-ink'
                      : 'border-slate-200/90 bg-white text-slate-700'
                  }`}
                >
                  {!message.content && message.role === 'assistant' && !message.isIncomplete ? (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                      正在生成内容
                    </span>
                  ) : (
                    `${message.content || ''}${message.isIncomplete ? '...' : ''}` || '...'
                  )}
                </article>
              </div>
            ))}
          </div>

          {/* 用户向上滚动时显示「回到底部」按钮，点击后平滑滚动到最新消息 */}
          {showScrollToBottom && (
            <button
              type="button"
              onClick={scrollToBottom}
              aria-label="滚动到底部"
              className="absolute bottom-3 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 shadow-md backdrop-blur transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14" />
                <path d="m6 13 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-3 w-full max-w-3xl self-center space-y-2">
        <div className="relative w-full rounded-2xl border border-slate-300 bg-white px-3 pb-12 pt-2 shadow-[0_8px_24px_-12px_rgba(14,116,144,0.18),inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-200/70">
            <textarea
              ref={promptTextareaRef}
              rows={1}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handlePromptKeyDown}
              className="max-h-[160px] min-h-[44px] w-full resize-none border-none bg-transparent py-1 text-sm leading-6 text-slate-800 outline-none"
              placeholder="发消息或输入“/”选择技能"
            />

            <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-between">
              <div className="pointer-events-auto flex items-center gap-2">
                {promptQuickActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    title={`${action.label}功能即将上线`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {action.key === 'file' && (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                        <path d="M14 3v5h5" />
                      </svg>
                    )}
                    {action.key === 'image' && (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <circle cx="9" cy="10" r="1.4" />
                        <path d="m21 16-5.5-5.5L8 18" />
                      </svg>
                    )}
                    {action.key === 'translate' && (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 5h10" />
                        <path d="M9 3v2" />
                        <path d="M7 9c.8 1.8 2.2 3.5 4 5" />
                        <path d="M5 13c2.5-1.3 4.7-3.5 6-6" />
                        <path d="m14 17 3-8 3 8" />
                        <path d="M15.2 14h3.6" />
                      </svg>
                    )}
                    {action.key === 'takeout' && (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 11h16" />
                        <path d="M6 11v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6" />
                        <path d="M9 11V7a3 3 0 0 1 6 0v4" />
                        <path d="M10 15h4" />
                      </svg>
                    )}
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-label="发送消息"
                disabled={!canSend}
                onClick={sendPrompt}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-600 to-sky-600 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {/* 流状态指示灯 */}
            <span className="flex items-center gap-0">
              <span className={`inline-block h-2 w-2 rounded-full ${isStreaming ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
            </span>
            <span>消息数: <b className="text-slate-800">{memoryMetrics.messageCount}</b> / {memoryMetrics.summaryTriggerMessageCount}</span>
            <span>会话 token: <b className="text-slate-800">{memoryMetrics.conversationTokensEstimate}</b></span>
            <span>摘要 token: <b className="text-slate-800">{memoryMetrics.summaryTokensEstimate}</b></span>
            <span>输入预算: <b className="text-slate-800">{memoryMetrics.budgetTokensEstimate}</b></span>
            <span
              className={`font-medium ${memoryMetrics.isSummaryThresholdReached ? 'text-emerald-700' : 'text-amber-700'}`}
            >
              摘要: {memoryMetrics.isSummaryThresholdReached ? '已触发' : '未触发'}
            </span>
          </div>
          {currentTimelineEvent && (
            <p className="mt-1 truncate text-slate-500">
              {stageLabelMap[currentTimelineEvent.stage]} / {statusLabelMap[currentTimelineEvent.status]}: {currentTimelineEvent.message}
            </p>
          )}
        </div>

        {/* {tokenMessage && <p className="text-xs text-slate-600">{tokenMessage}</p>} */}
      </div>
      </div>
    </section>
  );
};
