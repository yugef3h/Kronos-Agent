import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createWorkflowApp, listWorkflowApps } from '../../../features/workflow/workflowAppStore';

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [apps, setApps] = useState(() => listWorkflowApps());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(
    searchParams.get('create') === 'blank',
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get('create') === 'blank') {
      setIsCreateModalOpen(true);
    }
  }, [searchParams]);

  const openCreateModal = () => {
    setErrorMessage('');
    setIsCreateModalOpen(true);

    const next = new URLSearchParams(searchParams);
    next.set('create', 'blank');
    setSearchParams(next, { replace: true });
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setName('');
    setDescription('');
    setErrorMessage('');
    setIsSubmitting(false);

    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      setErrorMessage('应用名称至少 2 个字符。');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const app = createWorkflowApp({
        name: normalizedName,
        description,
      });
      setApps(listWorkflowApps());
      navigate(`/workflow/draft?appId=${encodeURIComponent(app.id)}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '创建失败，请重试。');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="space-y-4">
        <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-[0_24px_60px_-32px_rgba(8,145,178,0.35)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
              Applications
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">工作流应用</h3>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">创建应用</p>
              <div className="mt-3 space-y-2 text-sm">
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-medium text-slate-700 transition hover:bg-slate-50 font-bold border"
                >
                  <span className="text-base leading-none">＋</span>
                  <span>创建空白应用</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-medium text-slate-400"
                  disabled
                >
                  <span className="text-base leading-none">⭳</span>
                  <span>从应用模板创建（即将上线）</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-medium text-slate-400"
                  disabled
                >
                  <span className="text-base leading-none">⭳</span>
                  <span>导入 DSL 文件（即将上线）</span>
                </button>
              </div>
            </div>

            {apps.map((app) => (
              <Link
                key={app.id}
                to={`/workflow/draft?appId=${encodeURIComponent(app.id)}`}
                className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 text-lg">
                    🤖
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-cyan-700">
                      {app.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      更新时间 {formatTimestamp(app.updatedAt)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                  {app.description || '无描述'}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700">
                    {app.dsl.nodes.length} 节点
                  </span>
                  <span className="text-xs font-semibold text-cyan-700 opacity-0 transition group-hover:opacity-100">
                    点击进入
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>

      {isCreateModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/35 px-3"
          onClick={closeCreateModal}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-[0_24px_60px_-32px_rgba(217,119,6,0.32)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Blank App
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">创建空白应用</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  创建后会生成最小空白 DSL，然后进入 `/workflow/draft` 继续创建工作流。
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                关闭
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4">
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="workflow-app-name"
              >
                应用名称
              </label>
              <input
                id="workflow-app-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：客服自动化流程"
                maxLength={40}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400"
              />

              <label
                className="mt-4 block text-sm font-medium text-slate-700"
                htmlFor="workflow-app-description"
              >
                应用描述（可选）
              </label>
              <textarea
                id="workflow-app-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={120}
                placeholder="描述这个工作流应用的用途"
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400"
              />

              {errorMessage ? <p className="mt-3 text-sm text-rose-600">{errorMessage}</p> : null}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? '创建中...' : '创建并进入创建页'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
};
