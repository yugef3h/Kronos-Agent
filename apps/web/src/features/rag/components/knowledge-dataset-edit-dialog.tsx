import { type FormEvent, useEffect, useState } from 'react';
import type { KnowledgeDatasetDetail } from '../../../pages/workflow/features/knowledge-retrieval-panel/types';

export type KnowledgeDatasetEditDialogProps = {
  dataset: KnowledgeDatasetDetail | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSave: (payload: { name: string; description: string }) => Promise<void>;
};

export const KnowledgeDatasetEditDialog = ({
  dataset,
  isSubmitting = false,
  onClose,
  onSave,
}: KnowledgeDatasetEditDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!dataset) {
      return;
    }
    setName(dataset.name);
    setDescription(dataset.description ?? '');
    setErrorMessage('');
  }, [dataset]);

  if (!dataset) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      setErrorMessage('知识库名称至少 2 个字符。');
      return;
    }

    setErrorMessage('');

    try {
      await onSave({
        name: normalizedName,
        description: description.trim(),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存失败，请重试。');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/35 px-3"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-[0_24px_60px_-32px_rgba(8,145,178,0.35)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-dataset-edit-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Knowledge</p>
            <h3 id="knowledge-dataset-edit-title" className="mt-2 text-xl font-semibold text-slate-900">
              编辑信息
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
          >
            关闭
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="knowledge-dataset-edit-name">
            知识库名称
          </label>
          <input
            id="knowledge-dataset-edit-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：产品文档库"
            maxLength={40}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400"
          />

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="knowledge-dataset-edit-description">
            知识库描述（可选）
          </label>
          <textarea
            id="knowledge-dataset-edit-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={200}
            placeholder="描述这个知识库的用途"
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400"
          />

          {errorMessage ? <p className="mt-3 text-sm text-rose-600">{errorMessage}</p> : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
