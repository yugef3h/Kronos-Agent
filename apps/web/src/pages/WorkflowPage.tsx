export const WorkflowPage = () => {
    return (
        <section className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white/85 px-5 py-4 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Workflow</p>
                <h2 className="mt-1 font-display text-2xl text-slate-900">Workflow 空间</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    这里作为工作流应用主入口，后续可以继续挂接节点编排、运行面板和调试信息。
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-[0_24px_60px_-32px_rgba(8,145,178,0.35)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Workspace View</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">工作流应用</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                        当前先保留最小页面骨架，用来承接从导航菜单进入的 workflow 应用视图。
                    </p>
                </section>

                <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.25)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
                    <div className="mt-3 space-y-3 text-sm text-slate-600">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">入口路由：/workflow</div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">适合作为工作流应用主页</div>
                    </div>
                </section>
            </div>
        </section>
    );
};