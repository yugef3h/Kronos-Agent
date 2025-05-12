import { Link, useSearchParams } from 'react-router-dom';

export const WorkflowDraftPage = () => {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId');

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200/80 bg-white/85 px-5 py-4 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Workflow Draft</p>
        <h2 className="mt-1 font-display text-2xl text-slate-900">工作流创建页</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          `/workflow/draft` 作为工作流编排与创建页面，空白应用创建交互已统一迁移到 `/workflow` 弹窗。
        </p>
      </div>

      <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-[0_24px_60px_-32px_rgba(217,119,6,0.32)]">
        {appId ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Editing Target</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">正在创建工作流</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">当前应用 ID：{appId}</p>
            <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-600">
              下一步可在这里接入 ReactFlow 画布、节点编排和运行调试面板。
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">No App Selected</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">尚未选择应用</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              请先回到 Workflow 空间，通过“创建空白应用”弹窗完成初始化，再进入本页。
            </p>
            <Link
              to="/workflow?create=blank"
              className="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              去创建空白应用
            </Link>
          </>
        )}
      </div>
    </section>
  );
};
