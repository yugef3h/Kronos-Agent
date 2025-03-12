export const TokenEmbeddingPanel = () => {
  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink">Token and Embedding Debugger</h2>
      <p className="mt-1 text-sm text-slate-600">已预留 TextSplitter 与 Embedding 可视化入口，下一步接入 LangChain.js。</p>
      <ul className="mt-3 space-y-1 text-sm text-slate-700">
        <li>- Token split timeline</li>
        <li>- Model tokenizer diff panel</li>
        <li>- Embedding projection scatter (ECharts)</li>
      </ul>
    </section>
  );
};
