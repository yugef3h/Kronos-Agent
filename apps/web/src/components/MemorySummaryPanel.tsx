export const MemorySummaryPanel = () => {
  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink">Long Context Memory</h2>
      <p className="mt-1 text-sm text-slate-600">规划接入 ConversationSummaryMemory，对比压缩前后推理差异。</p>
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Memory status: scaffolded and ready for LangChain adapter.
      </div>
    </section>
  );
};
