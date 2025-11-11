import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { KnowledgeDatasetDetail } from '../pages/workflow/features/knowledge-retrieval-panel/types';
import { Dialog, DialogContent, DialogTitle } from '../pages/workflow/base/dialog';
import PanelAlert from '../pages/workflow/base/panel-alert';
import { PanelToken } from '../pages/workflow/base/panel-form';
import { buildKnowledgeDatasetPagePath } from '../pages/workflow/features/knowledge-retrieval-panel/navigation';

export const formatDatasetUpdatedAt = (value?: number) => {
  if (!value) return '未同步';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
};

const getDatasetPickerBadgeLabel = (dataset: KnowledgeDatasetDetail) => {
  const indexingLabel = dataset.indexing_technique === 'high_quality' ? '高质量' : '经济';
  const searchMethodLabelMap = {
    semantic_search: '向量检索',
    full_text_search: '全文检索',
    keyword_search: '关键词检索',
    hybrid_search: '混合检索',
  } as const;
  const searchMethodLabel = dataset.retrieval_model?.search_method
    ? searchMethodLabelMap[dataset.retrieval_model.search_method]
    : '向量检索';
  return `${indexingLabel} · ${searchMethodLabel}`;
};

export type KnowledgeDatasetPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 已保存的选中项；弹窗从关闭到打开时会用其初始化待选 */
  committedDatasetIds: readonly string[];
  datasets: readonly KnowledgeDatasetDetail[];
  isLoading: boolean;
  errorMessage?: string | null;
  onRefresh: () => void | Promise<unknown>;
  onConfirm: (datasetIds: string[]) => void;
  /** 标题下的灰色说明（可选） */
  titleHint?: ReactNode;
};

export const KnowledgeDatasetPickerDialog = ({
  open,
  onOpenChange,
  committedDatasetIds,
  datasets,
  isLoading,
  errorMessage,
  onRefresh,
  onConfirm,
  titleHint,
}: KnowledgeDatasetPickerDialogProps) => {
  const [pendingDatasetIds, setPendingDatasetIds] = useState<string[]>([]);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setPendingDatasetIds([...committedDatasetIds]);
      void onRefresh();
    }
    wasOpenRef.current = open;
  }, [open, committedDatasetIds, onRefresh]);

  const openKnowledgeDatasetPage = () => {
    const targetPath = buildKnowledgeDatasetPagePath(committedDatasetIds[0] ?? datasets[0]?.id);
    const openedWindow = window.open(targetPath, '_blank', 'noopener,noreferrer');
    if (!openedWindow) window.location.assign(targetPath);
  };

  const handlePendingDatasetToggle = (datasetId: string) => {
    setPendingDatasetIds((current) => {
      const exists = current.includes(datasetId);
      return exists ? current.filter((id) => id !== datasetId) : [...current, datasetId];
    });
  };

  const handleConfirm = () => {
    if (!pendingDatasetIds.length) return;
    onConfirm(pendingDatasetIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px] max-w-[calc(100vw-1rem)] p-0">
        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>
                <span className="text-[15px] font-semibold text-slate-900">关联知识库</span>
              </DialogTitle>
              {titleHint ? <div className="mt-1 text-xs text-slate-500">{titleHint}</div> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={isLoading}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="刷新知识库列表"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                  <path
                    d="M20 12a8 8 0 1 1-2.343-5.657"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 4v6h-6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={openKnowledgeDatasetPage}
                className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                新建/管理
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {errorMessage ? <PanelAlert type="warning">{errorMessage}</PanelAlert> : null}

            {isLoading ? (
              <p className="py-6 text-center text-sm text-slate-500">加载中…</p>
            ) : datasets.length ? (
              <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
                {datasets.map((dataset) => {
                  const selected = pendingDatasetIds.includes(dataset.id);
                  return (
                    <button
                      key={dataset.id}
                      type="button"
                      onClick={() => handlePendingDatasetToggle(dataset.id)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        selected
                          ? 'border-blue-500 bg-blue-50 shadow-[0_10px_24px_-20px_rgba(59,130,246,0.45)]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      } focus:outline-none focus-visible:ring-0 focus-visible:ring-blue-100`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M6 5.5h12v13H6z"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M9 9.5h6M9 13h6M9 16.5h4"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-slate-800">{dataset.name}</p>
                            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                              {dataset.description || '未填写描述'}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                              <span>{dataset.documentCount ?? 0} 文档</span>
                              <span>{dataset.chunkCount ?? 0} chunks</span>
                              <span>{formatDatasetUpdatedAt(dataset.updatedAt)}</span>
                            </div>
                          </div>
                        </div>
                        <PanelToken className="!border-slate-200 !text-slate-500">
                          {getDatasetPickerBadgeLabel(dataset)}
                        </PanelToken>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center">
                <p className="text-[12px] font-semibold text-slate-700">还没有可关联的知识库</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  去知识库页面新建或导入后，这里会自动刷新并列出已有项。
                </p>
                <button
                  type="button"
                  onClick={openKnowledgeDatasetPage}
                  className="mt-3 inline-flex h-8 items-center rounded-lg border border-blue-300 bg-blue-600 px-3 text-[12px] font-semibold text-white transition hover:bg-blue-500"
                >
                  去知识库页创建
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-4">
              <p
                className={`text-[11px] font-semibold ${
                  pendingDatasetIds.length ? 'text-slate-700' : 'text-amber-700'
                }`}
              >
                {pendingDatasetIds.length
                  ? `${pendingDatasetIds.length} 个知识库被选中`
                  : '至少选择 1 个知识库'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-slate-300"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!pendingDatasetIds.length}
                  className="rounded-xl border border-blue-300 bg-blue-600 px-5 py-2 text-[12px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
