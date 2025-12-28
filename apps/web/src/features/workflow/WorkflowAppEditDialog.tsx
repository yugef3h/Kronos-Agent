import { type FormEvent, useEffect, useState } from 'react';
import {
  updateWorkflowAppMeta,
  type WorkflowAppRecord,
} from './workflowAppStore';

export type WorkflowAppEditDialogProps = {
  app: WorkflowAppRecord | null;
  onClose: () => void;
  onSaved: (app: WorkflowAppRecord) => void;
};

export const WorkflowAppEditDialog = ({ app, onClose, onSaved }: WorkflowAppEditDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!app) {
      return;
    }
    setName(app.name);
    setDescription(app.description ?? '');
    setErrorMessage('');
    setIsSubmitting(false);
  }, [app]);

  if (!app) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
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
      const updated = updateWorkflowAppMeta(app.id, {
        name: normalizedName,
        description,
      });
      if (!updated) {
        setErrorMessage('应用不存在或已被删除。');
        setIsSubmitting(false);
        return;
      }
      onSaved(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存失败，请重试。');
      setIsSubmitting(false);
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
        aria-labelledby="workflow-app-edit-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Application</p>
            <h3 id="workflow-app-edit-title" className="mt-2 text-xl font-semibold text-slate-900">
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

        <form onSubmit={handleSubmit} className="mt-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="workflow-app-edit-name">
            应用名称
          </label>
          <input
            id="workflow-app-edit-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：客服自动化流程"
            maxLength={40}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400"
          />

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="workflow-app-edit-description">
            应用描述（可选）
          </label>
          <textarea
            id="workflow-app-edit-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={120}
            placeholder="描述这个工作流应用的用途"
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
