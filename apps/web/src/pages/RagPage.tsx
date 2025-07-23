import { MemorySummaryPanel } from '../components/MemorySummaryPanel';

export const RagPage = () => {
  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200/80 bg-white/85 px-5 py-4 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700">RAG</p>
        <h2 className="mt-1 font-display text-2xl text-slate-900">知识库</h2>
      </div>

      <MemorySummaryPanel />
    </section>
  );
};