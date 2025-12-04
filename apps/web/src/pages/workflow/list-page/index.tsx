import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { WorkflowBlankAppCreateDialog } from '../../../features/workflow/WorkflowBlankAppCreateDialog';
import {
  WORKFLOW_APPS_STORAGE_KEY,
  getWorkflowAppEditorPath,
  getWorkflowDraftThumbnailSrc,
  listWorkflowApps,
  WORKFLOW_DRAFT_PREVIEW_STORAGE_PREFIX,
} from '../../../features/workflow/workflowAppStore';

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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [apps, setApps] = useState(() => listWorkflowApps());
  const isCreateModalOpen = searchParams.get('create') === 'blank';

  useEffect(() => {
    setApps(listWorkflowApps());
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onFocus = () => {
      setApps(listWorkflowApps());
    };
    const onWorkflowAppsChanged = () => {
      setApps(listWorkflowApps());
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === WORKFLOW_APPS_STORAGE_KEY ||
        event.key?.startsWith(WORKFLOW_DRAFT_PREVIEW_STORAGE_PREFIX)
      ) {
        setApps(listWorkflowApps());
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('kronos:workflow-apps-changed', onWorkflowAppsChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('kronos:workflow-apps-changed', onWorkflowAppsChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const openCreateModal = () => {
    const next = new URLSearchParams(searchParams);
    next.set('create', 'blank');
    setSearchParams(next, { replace: true });
  };

  const closeCreateModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <section className="min-w-0 flex-1 rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-[0_24px_60px_-32px_rgba(8,145,178,0.35)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
              Applications
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">工作流应用</h3>
          </div>

          <div className="mt-4 grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">创建应用</p>
              <div className="mt-3 space-y-2 text-sm">
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <span className="text-base leading-none">＋</span>
                  <span>创建空白应用</span>
                </button>
                {/* <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-medium text-slate-400"
                  disabled
                >
                  <span className="text-base leading-none">⭳</span>
                  <span>从应用模板创建（即将上线）</span>
                </button> */}
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

            {apps.map((app) => {
              const thumbSrc = getWorkflowDraftThumbnailSrc(app);
              const isPublished =
                app.dsl.app.mode === 'chat' && Boolean(app.mockPublished);
              const descTrimmed = app.description?.trim() ?? '';
              const descriptionText =
                descTrimmed.length === 0
                  ? isPublished
                    ? '已发布'
                    : '无描述'
                  : isPublished
                    ? `已发布，${descTrimmed}`
                    : descTrimmed;
              return (
              <Link
                key={app.id}
                to={getWorkflowAppEditorPath(app)}
                className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 text-lg">
                    🤖
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-cyan-700">
                      {app.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      更新时间 {formatTimestamp(app.updatedAt)}
                    </p>
                  </div>
                  {isPublished ? (
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-100"
                      title="已发布（本地）"
                      role="img"
                      aria-label="已发布"
                    >
                      <svg
                        viewBox="0 0 12 12"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M2.5 6.2 5.1 8.7 9.5 3.3" />
                      </svg>
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                  {descriptionText}
                </p>

                {thumbSrc ? (
                  <div className="mt-3 flex max-h-[96px] items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 p-1">
                    <img
                      src={thumbSrc}
                      alt=""
                      className="h-auto max-h-[92px] w-auto max-w-full object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between">
                  {/* <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700">
                    {app.dsl.nodes.length} 节点
                  </span> */}
                  <span className="text-xs font-semibold text-cyan-700 opacity-0 transition group-hover:opacity-100">
                    点击进入
                  </span>
                </div>
              </Link>
            );
            })}
          </div>
        </section>

      <WorkflowBlankAppCreateDialog
        open={isCreateModalOpen}
        onClose={closeCreateModal}
        onCreated={(app) => {
          setApps(listWorkflowApps());
          closeCreateModal();
          navigate(getWorkflowAppEditorPath(app));
        }}
      />
    </>
  );
};
