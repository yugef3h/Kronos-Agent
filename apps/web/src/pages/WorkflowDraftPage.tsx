import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createWorkflowApp } from '../features/workflow/workflowAppStore';

export const WorkflowDraftPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage('');

    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      setErrorMessage('应用名称至少 2 个字符。');
      return;
    }

    setIsSubmitting(true);

    try {
      const app = createWorkflowApp({
        name: normalizedName,
        description,
      });
      navigate(`/workflow?created=${encodeURIComponent(app.id)}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '创建失败，请重试。');
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-[0_24px_60px_-32px_rgba(217,119,6,0.32)]"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Blank App</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900">创建空白应用</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">创建后会生成一个最小空白 DSL（version / nodes / edges / metadata），并保存到浏览器本地存储。</p>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="workflow-app-name">
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

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="workflow-app-description">
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

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-xs text-slate-600">
            入口路由：/workflow/draft
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '创建中...' : '创建并进入应用空间'}
          </button>
        </div>
      </form>
    </section>
  );
};
