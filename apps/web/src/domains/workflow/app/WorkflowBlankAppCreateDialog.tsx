import { type FormEvent, useEffect, useState } from 'react';
import { cn } from '../editor/utils/classnames';
import {
  createWorkflowApp,
  type WorkflowAppCreationMode,
  type WorkflowAppRecord,
} from './workflowAppStore';

const ChatbotTypeIcon = () => (
  <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
    <circle cx="9" cy="16" r="3.5" fill="currentColor" />
    <circle cx="23" cy="9" r="3.5" fill="currentColor" />
    <circle cx="23" cy="23" r="3.5" fill="currentColor" />
    <path
      d="M12.2 14.3L18.5 11M12.2 17.7L18.5 21M20.5 12.2v7.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChatflowTypeIcon = () => (
  <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
    <path
      d="M7 10.5C7 8.57 8.57 7 10.5 7h15c1.93 0 3.5 1.57 3.5 3.5v6c0 1.93-1.57 3.5-3.5 3.5h-9.2L12 24v-4H10.5A3.5 3.5 0 0 1 7 19.5v-9Z"
      fill="#ffffff"
    />
    <path
      d="M11.5 12.5h11M11.5 16h7.5M11.5 19.5h5"
      stroke="#0369a1"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export type WorkflowBlankAppCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 应用已写入本地 store 后调用；可在此 `navigate` 或刷新列表 */
  onCreated: (app: WorkflowAppRecord) => void;
};

export const WorkflowBlankAppCreateDialog = ({ open, onClose, onCreated }: WorkflowBlankAppCreateDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appType, setAppType] = useState<WorkflowAppCreationMode>('advanced-chat');

  useEffect(() => {
    if (!open) {
      return;
    }
    setName('');
    setDescription('');
    setErrorMessage('');
    setIsSubmitting(false);
    setAppType('advanced-chat');
  }, [open]);

  if (!open) {
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
      const app = createWorkflowApp({
        name: normalizedName,
        description,
        appMode: appType,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kronos:workflow-apps-changed'));
      }
      onCreated(app);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '创建失败，请重试。');
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
        className="w-full max-w-xl rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-[0_24px_60px_-32px_rgba(217,119,6,0.32)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-blank-create-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Blank App</p>
            <h3 id="workflow-blank-create-title" className="mt-2 text-xl font-semibold text-slate-900">
              创建空白应用
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
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">选择应用类型</legend>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAppType('chat')}
                aria-pressed={appType === 'chat'}
                className={cn(
                  'flex w-full gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
                  appType === 'chat'
                    ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-300/70'
                    : 'border-slate-200 bg-white/95 hover:border-amber-200',
                )}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
                  <ChatbotTypeIcon />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">Chatbot</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    面向 RAG 等检索、上下文注入与回复生成基于 LLM 的对话机器人
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAppType('advanced-chat')}
                aria-pressed={appType === 'advanced-chat'}
                className={cn(
                  'flex w-full gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
                  appType === 'advanced-chat'
                    ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-300/70'
                    : 'border-slate-200 bg-white/95 hover:border-amber-200',
                )}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-sm">
                  <ChatflowTypeIcon />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">Chatflow</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    支持记忆的复杂多轮对话工作流
                  </span>
                </span>
              </button>
            </div>
          </fieldset>

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
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? '创建中...' : '创建并进入创建页'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
