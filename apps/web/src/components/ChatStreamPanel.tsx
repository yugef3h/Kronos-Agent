import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { apiUrl, requestDevToken, requestSessionSnapshot } from '../lib/api';
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

export const ChatStreamPanel = () => {
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
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [tokenMessage, setTokenMessage] = useState('');
  const [isMemoryStrategyOpen, setIsMemoryStrategyOpen] = useState(false);
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
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const timelineBodyRef = useRef<HTMLDivElement | null>(null);

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

  const sendPrompt = async () => {
    if (!canSend) return;

    if (!authToken) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'JWT token is required before sending requests.' }]);
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
        { role: 'assistant', content: 'stream interrupted, please retry.' },
      ]);
    }
  };

  const handlePromptKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter' && canSend) {
      event.preventDefault();
      void sendPrompt();
    }
  };

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink">SSE Chat Stream</h2>
      <p className="mt-1 text-sm text-slate-600">模拟 LangChain 输出流，后续可接真实 Agent 链路。</p>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Memory Realtime Metrics</p>
          <button
            type="button"
            aria-label="查看 memory 策略说明"
            onClick={() => setIsMemoryStrategyOpen(true)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-700 transition hover:bg-slate-100"
          >
            i
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700 md:grid-cols-3">
          <div className="rounded-lg bg-white px-2 py-1.5">消息数: {memoryMetrics.messageCount}</div>
          <div className="rounded-lg bg-white px-2 py-1.5">会话 token(est): {memoryMetrics.conversationTokensEstimate}</div>
          <div className="rounded-lg bg-white px-2 py-1.5">摘要 token(est): {memoryMetrics.summaryTokensEstimate}</div>
          <div className="rounded-lg bg-white px-2 py-1.5">输入预算(est): {memoryMetrics.budgetTokensEstimate}</div>
          <div className="rounded-lg bg-white px-2 py-1.5">摘要阈值: {memoryMetrics.summaryTriggerMessageCount} 条</div>
          <div
            className={`rounded-lg px-2 py-1.5 ${
              memoryMetrics.isSummaryThresholdReached
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            阈值状态: {memoryMetrics.isSummaryThresholdReached ? '已达到' : '未达到'}
          </div>
        </div>
      </div>

      <div ref={messageListRef} className="mt-4 max-h-72 space-y-3 overflow-auto rounded-xl border border-slate-200 p-3">
        {messages.length === 0 && <p className="text-sm text-slate-500">Start a prompt to see token streaming.</p>}
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={`rounded-lg px-3 py-2 text-sm ${
              message.role === 'user' ? 'ml-10 bg-cyan-50 text-ink' : 'mr-10 bg-slate-100 text-slate-700'
            }`}
          >
            {message.content || '...'}
          </article>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex gap-3">
          <input
            value={authToken}
            onChange={(event) => setAuthToken(event.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-accent transition focus:ring"
            placeholder="JWT will be auto-generated"
          />
          <button
            type="button"
            onClick={() => void generateDevToken()}
            disabled={isGeneratingToken}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingToken ? '生成中...' : '生成测试 JWT'}
          </button>
        </div>

        <div className="flex gap-3">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-accent transition focus:ring"
            placeholder="输入一个你想调试的提示词"
          />
          <button
            type="button"
            disabled={!canSend}
            onClick={sendPrompt}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStreaming ? 'Streaming...' : 'Send'}
          </button>
        </div>

        <div className="rounded-2xl border border-cyan-200/70 bg-gradient-to-r from-cyan-50 via-sky-50 to-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">🧠</span>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Agent Thinking Flow</p>
            </div>
            <span
              className={`h-2 w-2 rounded-full ${isStreaming ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden
            />
          </div>

          <div ref={timelineBodyRef} className="mt-2 space-y-2 pr-1 text-xs transition-[height] duration-200">
            {!currentTimelineEvent && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-2 py-1.5 text-slate-500">
                暂无当前思考状态。发送提示词后，这里会实时更新 Agent 当前步骤。
              </p>
            )}

            {currentTimelineEvent && (
              <article key={currentTimelineEvent.eventId} className="rounded-xl border border-cyan-100 bg-white/85 px-2.5 py-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
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
              <p>1. 滚动摘要: 会话消息达到阈值后，系统将较旧历史压缩到 summary，减少每轮传入模型的上下文长度。</p>
              <p>2. 预算编排: 每轮请求根据输入预算动态裁剪 history，优先保留最近轮次，避免接近窗口上限导致卡顿。</p>
              <p>3. 透明可观测: 本面板实时显示消息数、token 估算、阈值状态，便于你调试 40% 上下文拐点前后的性能变化。</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
