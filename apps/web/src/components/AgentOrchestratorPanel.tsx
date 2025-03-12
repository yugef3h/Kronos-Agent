export const AgentOrchestratorPanel = () => {
  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink">Multi-Agent Orchestrator</h2>
      <p className="mt-1 text-sm text-slate-600">预留 Plan/Reason/Tool 三阶段轨迹可视化，支持 Agent 对比。</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-700">
        <span className="rounded bg-cyan-50 px-2 py-1">Planner</span>
        <span className="rounded bg-amber-50 px-2 py-1">Reasoner</span>
        <span className="rounded bg-emerald-50 px-2 py-1">Tool Runner</span>
      </div>
    </section>
  );
};
