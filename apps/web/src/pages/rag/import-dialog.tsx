import type { Dispatch, SetStateAction } from 'react';
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogTitle,
} from '../workflow/base/dialog';
import type { KnowledgeDatasetDetail } from '../workflow/features/knowledge-retrieval-panel/types';
import type { ImportFormState, LocalImportPreview, PendingImportConfig } from './types';
import { formatFileSize } from './utils';

type RagImportDialogProps = {
  open: boolean;
  pendingImport: PendingImportConfig | null;
  pendingDataset?: KnowledgeDatasetDetail;
  importForm: ImportFormState;
  setImportForm: Dispatch<SetStateAction<ImportFormState>>;
  importFormError: string;
  isImporting: boolean;
  isMutating: boolean;
  localPreview: LocalImportPreview | null;
  isPreviewLoading: boolean;
  previewError: string;
  hasRequestedPreview: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  onRequestPreview: () => void;
  onReset: () => void;
};

export const RagImportDialog = ({
  open,
  pendingImport,
  pendingDataset,
  importForm,
  setImportForm,
  importFormError,
  isImporting,
  isMutating,
  localPreview,
  isPreviewLoading,
  previewError,
  hasRequestedPreview,
  onOpenChange,
  onClose,
  onConfirm,
  onRequestPreview,
  onReset,
}: RagImportDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="bg-slate-950/56" className="flex h-[min(84vh,760px)] w-[min(920px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col overflow-hidden !bg-white p-0">
        <DialogCloseButton aria-label="关闭导入弹窗" className="right-4 top-3" />

        <div className="border-b border-slate-200 bg-white px-4 py-3 pr-14">
          <DialogTitle className="text-base font-semibold text-slate-900">
            导入文件
          </DialogTitle>
        </div>

        <div className="grid h-[calc(100%-65px-49px)] min-h-0 gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-3">
            <div className="space-y-3">
              {!pendingDataset ? (
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="min-w-0">
                    <span className="mb-1 block text-[11px] font-medium text-slate-600">知识库名称</span>
                    <input
                      type="text"
                      value={importForm.datasetName}
                      onChange={(event) => setImportForm((current) => ({ ...current, datasetName: event.target.value }))}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-[11px] font-medium text-slate-600">描述</span>
                    <input
                      type="text"
                      value={importForm.description}
                      onChange={(event) => setImportForm((current) => ({ ...current, description: event.target.value }))}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                  <span className="truncate">目标知识库</span>
                  <span className="truncate font-medium text-slate-900">{pendingDataset.name}</span>
                </div>
              )}

              <div className="grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <label className="min-w-0">
                  <span className="mb-1 block text-[11px] font-medium text-slate-600">分段标识符</span>
                  <input
                    type="text"
                    value={importForm.separator}
                    onChange={(event) => setImportForm((current) => ({ ...current, separator: event.target.value }))}
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-[11px] font-medium text-slate-600">最大长度</span>
                  <div className="flex overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                    <input
                      type="number"
                      value={importForm.segmentMaxLength}
                      onChange={(event) => setImportForm((current) => ({ ...current, segmentMaxLength: event.target.value }))}
                      className="w-full px-2.5 py-1.5 text-sm text-slate-900 outline-none"
                    />
                    <span className="border-l border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-500">char</span>
                  </div>
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-[11px] font-medium text-slate-600">重叠长度</span>
                  <div className="flex overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                    <input
                      type="number"
                      value={importForm.overlapLength}
                      onChange={(event) => setImportForm((current) => ({ ...current, overlapLength: event.target.value }))}
                      className="w-full px-2.5 py-1.5 text-sm text-slate-900 outline-none"
                    />
                    <span className="border-l border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-500">char</span>
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
                <span className="text-[11px] font-medium text-slate-600">文本预处理</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={importForm.normalizeWhitespace}
                    onChange={(event) => setImportForm((current) => ({ ...current, normalizeWhitespace: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>空白规整</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={importForm.removeUrlsEmails}
                    onChange={(event) => setImportForm((current) => ({ ...current, removeUrlsEmails: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>移除 URL / 邮箱</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <span className="shrink-0 text-[11px] font-medium text-slate-600">召回 Top K</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={importForm.topK}
                  onChange={(event) => setImportForm((current) => ({ ...current, topK: event.target.value }))}
                  className="w-14 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={Number(importForm.topK) || 1}
                  onChange={(event) => setImportForm((current) => ({ ...current, topK: event.target.value }))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600"
                />
                <span className="w-5 text-right text-xs text-slate-500">{importForm.topK}</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onRequestPreview}
                  className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  预览块
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  重置
                </button>
              </div>
            </div>
          </div>

          <aside className="min-h-0 overflow-hidden bg-slate-50 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">预览</p>
                <p className="text-[11px] text-slate-500">
                  {isPreviewLoading
                    ? '正在生成预览...'
                    : !hasRequestedPreview
                      ? ''
                      : `${localPreview?.totalNodes ?? (pendingImport?.files.length ?? 0)} 个文件，${localPreview?.totalChunks ?? 0} blocks，${localPreview?.tokens ?? 0} tokens`}
                </p>
              </div>
              <span className="text-[11px] text-slate-500">
                {formatFileSize((pendingImport?.files || []).reduce((sum, file) => sum + file.size, 0))}
              </span>
            </div>

            {previewError ? (
              <p className="mb-2 text-sm text-rose-600">{previewError}</p>
            ) : null}

            <div className="h-full min-h-0 overflow-y-auto pr-1">
              <div className="space-y-1.5 pb-12">
                {localPreview?.chunks.length ? localPreview.chunks.map((chunk) => (
                  <div key={chunk.id} className="rounded-md bg-white px-2.5 py-2 shadow-sm">
                    <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
                      <span className="truncate">{chunk.fileName}</span>
                      <span>#{chunk.index + 1}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-slate-700">{chunk.text}</p>
                  </div>
                )) : (
                  <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-5 text-center text-sm text-slate-500">
                    暂无预览块
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3">
          {importFormError ? (
            <p className="mb-2 text-sm text-rose-600">{importFormError}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isImporting || isMutating}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? '处理中...' : '保存并处理'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};