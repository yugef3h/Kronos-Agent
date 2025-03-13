import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { apiUrl, requestDevToken } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';
import type { ChatMessage, StreamChunk } from '../types/chat';

export const ChatStreamPanel = () => {
  const { sessionId, authToken, setAuthToken, appendTimelineEvent, clearTimelineEvents } = usePlaygroundStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [tokenMessage, setTokenMessage] = useState('');
  // 防止旧请求回调与新请求并发写入，导致消息重复拼接。
  const activeRequestIdRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);

  const canSend = useMemo(() => prompt.trim().length > 0 && !isStreaming, [prompt, isStreaming]);

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

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink">SSE Chat Stream</h2>
      <p className="mt-1 text-sm text-slate-600">模拟 LangChain 输出流，后续可接真实 Agent 链路。</p>

      <div className="mt-4 max-h-72 space-y-3 overflow-auto rounded-xl border border-slate-200 p-3">
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
      </div>
      {tokenMessage && <p className="mt-2 text-xs text-slate-600">{tokenMessage}</p>}
    </section>
  );
};
