import { useMemo, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { apiUrl } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';
import type { ChatMessage, StreamChunk } from '../types/chat';

export const ChatStreamPanel = () => {
  const { sessionId } = usePlaygroundStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const canSend = useMemo(() => prompt.trim().length > 0 && !isStreaming, [prompt, isStreaming]);

  const sendPrompt = async () => {
    if (!canSend) return;

    const controller = new AbortController();
    const userPrompt = prompt.trim();

    setPrompt('');
    setMessages((prev) => [...prev, { role: 'user', content: userPrompt }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      await fetchEventSource(apiUrl('/api/chat-stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userPrompt, sessionId }),
        signal: controller.signal,
        onmessage(event) {
          const payload = JSON.parse(event.data) as StreamChunk;

          if (payload.type === 'content' && payload.content) {
            setMessages((prev) => {
              const draft = [...prev];
              const last = draft[draft.length - 1];
              if (!last || last.role !== 'assistant') return draft;
              last.content += payload.content;
              return draft;
            });
          }

          if (payload.type === 'complete') {
            setIsStreaming(false);
          }
        },
        onerror(error) {
          setIsStreaming(false);
          throw error;
        },
        onclose() {
          setIsStreaming(false);
        },
      });
    } catch {
      setIsStreaming(false);
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

      <div className="mt-4 flex gap-3">
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
    </section>
  );
};
