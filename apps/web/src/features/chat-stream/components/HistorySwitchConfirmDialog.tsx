type HistorySwitchConfirmDialogProps = {
  targetSessionId: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export const HistorySwitchConfirmDialog = ({
  targetSessionId,
  onCancel,
  onConfirm,
}: HistorySwitchConfirmDialogProps) => {
  return (
    <div className="absolute inset-0 z-[70] flex items-end justify-center bg-black/45 px-0 pt-8 md:items-center md:px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-t-[24px] bg-white p-4 shadow-[0_30px_70px_-24px_rgba(2,6,23,0.5)] md:rounded-[24px] md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700">Session Switch</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">覆盖当前对话？</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
            aria-label="关闭历史切换确认"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm leading-6 text-slate-600">
          <p>当前聊天面板里已经有内容，继续切换会清空当前上下文并加载历史会话。</p>
          <p className="mt-2 text-xs text-slate-500">目标 session: {targetSessionId}</p>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-2.5 text-sm font-medium text-white transition hover:from-cyan-500 hover:to-sky-500"
          >
            继续切换
          </button>
        </div>
      </div>
    </div>
  );
};