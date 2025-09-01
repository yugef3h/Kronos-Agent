import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogTitle,
} from '../workflow/base/dialog';
import type { KnowledgeDatasetDetail } from '../workflow/features/knowledge-retrieval-panel/types';
import type { DatasetDocumentDetail, FlattenedDatasetDocumentBlock } from './types';
import { formatTimestamp } from './utils';

type RagDatasetDetailDialogProps = {
  open: boolean;
  selectedDataset: KnowledgeDatasetDetail | null;
  datasetDocuments: DatasetDocumentDetail[];
  documentsError: string;
  documentBlocksError: string;
  isDocumentsLoading: boolean;
  isDocumentBlocksLoading: boolean;
  flattenedDocumentBlocks: FlattenedDatasetDocumentBlock[];
  savingBlockKeywordId: string;
  blockKeywordDrafts: Record<string, string>;
  onOpenChange: (nextOpen: boolean) => void;
  onKeywordDraftChange: (blockId: string, value: string) => void;
  onKeywordCommit: (block: FlattenedDatasetDocumentBlock) => void;
  onKeywordRemove: (block: FlattenedDatasetDocumentBlock, keyword: string) => void;
};

export const RagDatasetDetailDialog = ({
  open,
  selectedDataset,
  datasetDocuments,
  documentsError,
  documentBlocksError,
  isDocumentsLoading,
  isDocumentBlocksLoading,
  flattenedDocumentBlocks,
  savingBlockKeywordId,
  blockKeywordDrafts,
  onOpenChange,
  onKeywordDraftChange,
  onKeywordCommit,
  onKeywordRemove,
}: RagDatasetDetailDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="bg-slate-950/56" className="flex h-[min(82vh,760px)] w-[min(780px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col overflow-hidden !bg-white p-0">
        <DialogCloseButton aria-label="关闭知识库详情弹窗" className="right-4 top-3" />
        <div className="border-b border-slate-200 bg-white px-4 py-3 pr-14">
          <DialogTitle className="text-base font-semibold text-slate-900">
            {selectedDataset?.name || '知识库详情'}
          </DialogTitle>

          {selectedDataset ? (
            <div className="ml-[-10px] flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-white px-2.5 py-1">{selectedDataset.documentCount ?? 0} 文档</span>
              <span className="rounded-full bg-white px-2.5 py-1">{selectedDataset.chunkCount ?? 0} chunks</span>
              <span className="rounded-full bg-white px-2.5 py-1">更新时间 {formatTimestamp(selectedDataset.updatedAt)}</span>
              {selectedDataset.doc_metadata.length ? selectedDataset.doc_metadata.map((field) => (
                <span key={field.key} className="rounded-full bg-cyan-50 px-2.5 py-1 text-cyan-700">字段 {field.label}</span>
              )) : null}
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-4 py-4">
          {documentsError ? (
            <p className="mb-4 text-sm text-rose-600">{documentsError}</p>
          ) : null}

          {documentBlocksError ? (
            <p className="mb-4 text-sm text-rose-600">{documentBlocksError}</p>
          ) : null}

          <div className="space-y-2">
            {isDocumentsLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                正在加载知识库详情...
              </div>
            ) : null}

            {!isDocumentsLoading && !selectedDataset ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                还没有可查看的知识库。
              </div>
            ) : null}

            {!isDocumentsLoading && selectedDataset && !datasetDocuments.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                这个知识库还没有文档，保存并处理后会在这里显示文档详情。
              </div>
            ) : null}

            {isDocumentBlocksLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                正在从后端加载完整 blocks...
              </div>
            ) : null}

            {!isDocumentsLoading && !isDocumentBlocksLoading && datasetDocuments.length && !flattenedDocumentBlocks.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                暂无可展示的 blocks。
              </div>
            ) : null}

            {!isDocumentBlocksLoading && flattenedDocumentBlocks.length ? flattenedDocumentBlocks.map((block) => (
              <article key={block.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate rounded-full bg-cyan-50 px-2 py-1 font-medium text-cyan-700">{block.documentName}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">Block #{block.index + 1}</span>
                    {Object.entries(block.metadata).map(([key, value]) => (
                      <span key={`${block.id}-${key}`} className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">{key}: {value}</span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span>{block.charCount} chars</span>
                    <span>{block.tokenCount} tokens</span>
                  </div>
                </div>
                <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-600">Keywords</span>
                    {savingBlockKeywordId === block.id ? (
                      <span className="text-[11px] text-slate-400">保存中...</span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {block.keywords.map((keyword) => (
                      <span key={`${block.id}-${keyword}`} className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-[11px] font-medium text-cyan-700">
                        <span>{keyword}</span>
                        <button
                          type="button"
                          onClick={() => onKeywordRemove(block, keyword)}
                          className="text-cyan-500 transition hover:text-cyan-800"
                          aria-label={`删除关键词 ${keyword}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={blockKeywordDrafts[block.id] || ''}
                      placeholder={block.keywords.length ? '继续输入关键词' : '输入关键词后按回车'}
                      onChange={(event) => onKeywordDraftChange(block.id, event.target.value)}
                      onBlur={() => onKeywordCommit(block)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === 'Tab' || event.key === ',' || event.key === '，') {
                          event.preventDefault();
                          onKeywordCommit(block);
                          return;
                        }

                        if (event.key === 'Backspace' && !(blockKeywordDrafts[block.id] || '').trim() && block.keywords.length) {
                          event.preventDefault();
                          onKeywordRemove(block, block.keywords[block.keywords.length - 1]);
                        }
                      }}
                      className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-xs text-slate-700 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">{block.text}</p>
              </article>
            )) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};