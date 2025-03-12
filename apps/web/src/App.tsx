import { motion } from 'framer-motion';
import { AgentOrchestratorPanel } from './components/AgentOrchestratorPanel';
import { AttentionHeatmap } from './components/AttentionHeatmap';
import { ChatStreamPanel } from './components/ChatStreamPanel';
import { MemorySummaryPanel } from './components/MemorySummaryPanel';
import { SamplingInspector } from './components/SamplingInspector';
import { TokenEmbeddingPanel } from './components/TokenEmbeddingPanel';
import { ToolInvocationPanel } from './components/ToolInvocationPanel';

const App = () => {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-ink md:px-8">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-8"
      >
        <p className="text-sm uppercase tracking-[0.2em] text-accent">Kronos Agent</p>
        <h1 className="font-display text-3xl md:text-5xl">LLM Insight Playground</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 md:text-base">
          一个面向前端 AI 工程师的原理可视化与 Agent 调试工作台，当前版本优先落地 LangChain.js + 豆包 + JWT 安全链路。
        </p>
      </motion.header>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChatStreamPanel />
        <SamplingInspector />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <AttentionHeatmap />
        <TokenEmbeddingPanel />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <MemorySummaryPanel />
        <AgentOrchestratorPanel />
        <ToolInvocationPanel />
      </section>
    </main>
  );
};

export default App;
