import { useState } from 'react';

import { AgentOrchestratorPanel } from '../components/AgentOrchestratorPanel';
import { ChatStreamPanel } from '../components/ChatStreamPanel';
import { MemorySummaryPanel } from '../components/MemorySummaryPanel';
import { SamplingInspector } from '../components/SamplingInspector';
import { TokenEmbeddingPanel } from '../components/TokenEmbeddingPanel';
import { ToolInvocationPanel } from '../components/ToolInvocationPanel';

export const HomePage = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="relative overflow-hidden h-[calc(100vh-80px)]">
      <button
        type="button"
        onClick={() => setIsMobileSidebarOpen(true)}
        className="absolute right-3 top-3 z-40 rounded-full border border-slate-300/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-cyan-300 hover:bg-cyan-50 lg:hidden"
      >
        调试面板
      </button>

      <div className="flex h-full gap-3 md:gap-4">
        <section className="min-w-0 flex-1">
          <ChatStreamPanel />
        </section>

        <aside className="hidden w-[550px] shrink-0 space-y-3 overflow-y-auto pb-2 pr-1 lg:block">
          <MemorySummaryPanel />
          <TokenEmbeddingPanel />
          <AgentOrchestratorPanel />
        </aside>
      </div>

      {isMobileSidebarOpen && (
        <div
          className="absolute inset-0 z-50 flex justify-end bg-slate-900/30"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <aside
            className="h-full w-[92vw] max-w-[380px] overflow-y-auto border-l border-slate-200 bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">调试面板</h2>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600"
              >
                关闭
              </button>
            </div>
            <div className="space-y-3 pb-6">
              <TokenEmbeddingPanel />
              <ToolInvocationPanel />
              <MemorySummaryPanel />
              <AgentOrchestratorPanel />
              <SamplingInspector />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};