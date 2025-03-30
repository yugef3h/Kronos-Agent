import { MemorySummaryPanel } from '../components/MemorySummaryPanel';

export const MemoryPage = () => {
  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200/80 bg-white/85 px-5 py-4 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Memory</p>
        <h2 className="mt-1 font-display text-2xl text-slate-900">上下文记忆</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">单独观察摘要压缩、上下文预算和会话记忆状态，便于调试长上下文表现。</p>
      </div>

      <MemorySummaryPanel />
    </section>
  );
};