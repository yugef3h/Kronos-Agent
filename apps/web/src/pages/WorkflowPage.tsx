import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listWorkflowApps } from '../features/workflow/workflowAppStore';

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const WorkflowPage = () => {
  const [searchParams] = useSearchParams();
  const createdId = searchParams.get('created');

  const apps = useMemo(() => {
    return listWorkflowApps();
  }, []);

  const createdApp = useMemo(() => {
    if (!createdId) {
      return null;
    }
    return apps.find((item) => item.id === createdId) ?? null;
  }, [apps, createdId]);

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200/80 bg-white/85 px-5 py-4 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Workflow</p>
        <h2 className="mt-1 font-display text-2xl text-slate-900">Workflow 空间</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          支持从“创建空白应用”入口生成工作流应用，并在此查看应用列表与基本状态。
        </p>
      </div>

      {createdApp ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          应用「{createdApp.name}」创建成功。
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-[0_24px_60px_-32px_rgba(8,145,178,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Applications</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">工作流应用</h3>
            </div>
            <Link
              to="/workflow/draft"
              className="rounded-xl bg-cyan-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
            >
              创建空白应用
            </Link>
          </div>

          {apps.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 px-4 py-4 text-sm text-slate-600">
              当前暂无应用，请先创建一个空白工作流应用。
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {apps.map((app) => (
                <li key={app.id} className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{app.name}</p>
                      <p className="mt-1 text-xs text-slate-500">ID: {app.id}</p>
                    </div>
                    <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-medium text-cyan-700">
                      {app.dsl.nodes.length} 节点
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{app.description || '无描述'}</p>
                  <p className="mt-2 text-xs text-slate-500">更新时间：{formatTimestamp(app.updatedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">入口路由：/workflow</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">创建路由：/workflow/draft</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">应用总数：{apps.length}</div>
          </div>
        </section>
      </div>
    </section>
  );
};
