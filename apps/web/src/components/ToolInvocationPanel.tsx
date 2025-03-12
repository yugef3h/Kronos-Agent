export const ToolInvocationPanel = () => {
  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink">Tool Invocation Debugger</h2>
      <p className="mt-1 text-sm text-slate-600">用于展示 Agent 的 tool selection、input、output 与错误恢复。</p>
      <div className="mt-3 rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
        <p>tool: attention_analyzer</p>
        <p>status: pending integration</p>
      </div>
    </section>
  );
};
