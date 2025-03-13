import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { apiUrl, requestDevToken } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';
import type { ChatMessage, StreamChunk, TimelineEvent } from '../types/chat';

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

  const currentTimelineEvent = useMemo(
    () => timelineEvents[timelineEvents.length - 1],
    [timelineEvents],
  );

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
              timestamp: payload.timestamp,
            });

            if (payload.message.includes('LangChain stream failed')) {
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
                  <span className={`rounded px-1.5 py-0.5 uppercase ${stageToneMap[currentTimelineEvent.stage]}`}>{currentTimelineEvent.stage}</span>
                  <span className={`rounded px-1.5 py-0.5 uppercase ${statusToneMap[currentTimelineEvent.status]}`}>{currentTimelineEvent.status}</span>
                  {currentTimelineEvent.toolName && (
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-700">{currentTimelineEvent.toolName}</span>
                  )}
                </div>
                <p className="mt-1.5 text-slate-700">{currentTimelineEvent.message}</p>
              </article>
            )}
          </div>
        </div>
      </div>
      {tokenMessage && <p className="mt-2 text-xs text-slate-600">{tokenMessage}</p>}
    </section>
  );
};
