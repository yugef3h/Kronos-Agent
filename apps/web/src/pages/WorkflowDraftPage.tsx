export const WorkflowDraftPage = () => {
  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200/80 bg-white/85 px-5 py-4 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Draft</p>
        <h2 className="mt-1 font-display text-2xl text-slate-900">工作流草稿</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          这个页面对应“创建空白应用”入口，先作为最简草稿编辑落点，后续可继续扩展初始化表单。
        </p>
      </div>

      <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-[0_24px_60px_-32px_rgba(217,119,6,0.32)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Blank App</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900">空白工作流初始化</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          当前提供独立页面区分“应用空间”和“草稿创建”，便于后面接真实的新建流程。
        </p>

        <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-600">
          入口路由：/workflow/draft
        </div>
      </div>
    </section>
  );
};