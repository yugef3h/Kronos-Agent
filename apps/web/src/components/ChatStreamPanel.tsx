import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { apiUrl, requestDevToken, requestRecentSessions, requestSessionSnapshot } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';
import type { ChatMessage, StreamChunk, TimelineEvent } from '../types/chat';

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
  key: 'file' | 'image' | 'translate';
  label: string;
};

export const ChatStreamPanel = () => {
  const PROMPT_MAX_HEIGHT = 300;
  const promptQuickActions: PromptQuickAction[] = [
    { key: 'file', label: '文件' },
    { key: 'image', label: '图像' },
    { key: 'translate', label: '翻译' },
  ];
  const {
    sessionId,
    authToken,
    timelineEvents,
    setAuthToken,
    appendTimelineEvent,
    clearTimelineEvents,
  } = usePlaygroundStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [, setIsGeneratingToken] = useState(false);
  const [tokenMessage, setTokenMessage] = useState('');
  const [isMemoryStrategyOpen, setIsMemoryStrategyOpen] = useState(false);
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
  const activeRequestIdRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const timelineBodyRef = useRef<HTMLDivElement | null>(null);
  const historyPanelRef = useRef<HTMLDivElement | null>(null);

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

  const canSend = useMemo(() => prompt.trim().length > 0 && !isStreaming, [prompt, isStreaming]);

  const stageToneMap: Record<TimelineEvent['stage'], string> = {
    plan: 'bg-indigo-100 text-indigo-700',
    tool: 'bg-cyan-100 text-cyan-700',
    reason: 'bg-emerald-100 text-emerald-700',
  };

  const statusToneMap: Record<TimelineEvent['status'], string> = {
    start: 'bg-amber-100 text-amber-700',
    end: 'bg-lime-100 text-lime-700',
    info: 'bg-slate-200 text-slate-700',
  };

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

  const toolLabelMap: Record<string, string> = {
    token_estimator: 'Token 估算器',
    attention_probe: '注意力探针',
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
      setMemoryMetrics(snapshot.memoryMetrics);
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
      setMessages(snapshot.messages);
      setMemoryMetrics(snapshot.memoryMetrics);
    } catch {
      // 刷新回显失败时保留当前页状态，不阻断继续提问。
    }
  }, [authToken, sessionId]);

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
    const timelineBodyElement = timelineBodyRef.current;
    if (!timelineBodyElement) {
      return;
    }

    // 高度跟随内容实时变化，避免固定高度导致信息被截断或留白。
    timelineBodyElement.style.height = 'auto';
    timelineBodyElement.style.height = `${timelineBodyElement.scrollHeight}px`;
  }, [currentTimelineEvent, isStreaming]);

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

  const sendPrompt = async () => {
    if (!canSend) return;

    if (!authToken) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '发送前需要先准备 JWT。' }]);
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    // 发起新请求前先终止旧流，保证同一时刻只有一个有效 SSE 流。
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    // 某些传输层在重连时会重放事件，按 eventId 去重可避免重复渲染。
    let lastSeenEventId = 0;
    const userPrompt = prompt.trim();

    clearTimelineEvents();
    setPrompt('');
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
              return [...draft.slice(0, -1), { ...last, content: `${last.content}${payload.content}` }];
            });
          }

          if (payload.type === 'complete') {
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
          if (requestId === activeRequestIdRef.current) {
            setIsStreaming(false);
            activeControllerRef.current = null;
          }
        },
      });
    } catch {
      if (requestId === activeRequestIdRef.current) {
        setIsStreaming(false);
        activeControllerRef.current = null;
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '流式输出中断，请重试。' },
      ]);
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
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_16px_48px_-24px_rgba(14,116,144,0.45)] backdrop-blur">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-cyan-100/70 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-100/80 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Agent Runtime</p>
          <h2 className="mt-1 font-display text-xl text-ink">SSE Chat Stream</h2>
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
      <p className="mt-1 text-sm text-slate-600">模拟 LangChain 输出流，支持实时思考状态与 memory 指标观测。</p>

      <div className="mt-4 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-cyan-50/70 to-sky-50/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Memory Realtime Metrics</p>
          <button
            type="button"
            aria-label="查看 memory 策略说明"
            onClick={() => setIsMemoryStrategyOpen(true)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100"
          >
            i
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-white px-2 py-1.5">消息数: {memoryMetrics.messageCount}</div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-2 py-1.5">会话 token(est): {memoryMetrics.conversationTokensEstimate}</div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-2 py-1.5">摘要 token(est): {memoryMetrics.summaryTokensEstimate}</div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-2 py-1.5">输入预算(est): {memoryMetrics.budgetTokensEstimate}</div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-2 py-1.5">摘要阈值: {memoryMetrics.summaryTriggerMessageCount} 条</div>
          <div
            className={`rounded-xl border px-2 py-1.5 ${
              memoryMetrics.isSummaryThresholdReached
                ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                : 'border-amber-200 bg-amber-100 text-amber-700'
            }`}
          >
            阈值状态: {memoryMetrics.isSummaryThresholdReached ? '已达到' : '未达到'}
          </div>
        </div>
      </div>

      <div ref={messageListRef} className="mt-4 max-h-72 space-y-3 overflow-auto rounded-2xl border border-slate-200 bg-gradient-to-b from-white via-slate-50/50 to-cyan-50/20 p-3 shadow-inner">
        {messages.length === 0 && <p className="text-sm text-slate-500">发送一条提示词，查看流式输出过程。</p>}
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={`rounded-2xl border px-3 py-2 text-sm shadow-sm ${
              message.role === 'user'
                ? 'ml-10 border-cyan-200 bg-cyan-50/90 text-ink'
                : 'mr-10 border-slate-200 bg-white text-slate-700'
            }`}
          >
            {!message.content && message.role === 'assistant' ? (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                正在生成内容
              </span>
            ) : (
              message.content || '...'
            )}
          </article>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {/* <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white/80 p-2">
          <input
            value={authToken}
            onChange={(event) => setAuthToken(event.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-300 transition focus:ring"
            placeholder="JWT 会自动生成，也可手动覆盖"
          />
          <button
            type="button"
            onClick={() => void generateDevToken()}
            disabled={isGeneratingToken}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingToken ? '生成中...' : '生成测试 JWT'}
          </button>
        </div> */}

        <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white/80 p-2">
          <div className="relative w-full rounded-2xl border border-slate-300 bg-white px-3 pb-12 pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-200/70">
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
        </div>

        <div className="rounded-2xl border border-cyan-200/80 bg-gradient-to-r from-cyan-50 via-sky-50 to-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-cyan-700 shadow-sm">AI</span>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Agent Thinking Flow</p>
            </div>
            <span
              className={`h-2 w-2 rounded-full ${isStreaming ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden
            />
          </div>

          <div ref={timelineBodyRef} className="mt-2 space-y-2 pr-1 text-xs transition-[height] duration-200">
            {!currentTimelineEvent && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-2 py-2 text-slate-500">
                暂无当前思考状态。发送提示词后，这里会实时更新 Agent 当前步骤。
              </p>
            )}

            {currentTimelineEvent && (
              <article key={currentTimelineEvent.eventId} className="rounded-xl border border-cyan-100 bg-white/90 px-2.5 py-2 shadow-[0_8px_20px_-14px_rgba(14,116,144,0.55)]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 ${stageToneMap[currentTimelineEvent.stage]}`}>{stageLabelMap[currentTimelineEvent.stage]}</span>
                  <span className={`rounded px-1.5 py-0.5 ${statusToneMap[currentTimelineEvent.status]}`}>{statusLabelMap[currentTimelineEvent.status]}</span>
                  {currentTimelineEvent.toolName && (
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-700">{toolLabelMap[currentTimelineEvent.toolName] ?? currentTimelineEvent.toolName}</span>
                  )}
                </div>
                <p className="mt-1.5 text-slate-700">{currentTimelineEvent.message}</p>
              </article>
            )}
          </div>
        </div>
      </div>
      {tokenMessage && <p className="mt-2 text-xs text-slate-600">{tokenMessage}</p>}

      {isMemoryStrategyOpen && (
        <div
          className="absolute inset-0 z-50 flex justify-center bg-slate-900/45 px-4 backdrop-blur-[1px]"
          onClick={() => setIsMemoryStrategyOpen(false)}
        >
          <div
            className="absolute top-[8%] w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg text-ink">Memory 策略说明</h3>
              <button
                type="button"
                onClick={() => setIsMemoryStrategyOpen(false)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                关闭
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
              <p><span className="font-semibold text-slate-900">1. 滚动摘要:</span> 会话消息达到阈值后，系统将较旧历史压缩到 summary，减少每轮传入模型的上下文长度。</p>
              <p><span className="font-semibold text-slate-900">2. 预算编排:</span> 每轮请求根据输入预算动态裁剪 history，优先保留最近轮次，避免接近窗口上限导致卡顿。</p>
              <p><span className="font-semibold text-slate-900">3. 透明可观测:</span> 本面板实时显示消息数、token 估算、阈值状态，便于你调试 40% 上下文拐点前后的性能变化。</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
