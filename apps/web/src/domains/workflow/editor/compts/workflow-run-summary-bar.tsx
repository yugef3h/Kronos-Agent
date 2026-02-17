import { WorkflowRunStatus, type WorkflowRunSummary } from '../types/run'

const statusLabel: Record<WorkflowRunStatus, string> = {
  [WorkflowRunStatus.Queued]: '排队中',
  [WorkflowRunStatus.Waiting]: '等待中',
  [WorkflowRunStatus.Running]: '运行中',
  [WorkflowRunStatus.Succeeded]: '运行成功',
  [WorkflowRunStatus.Failed]: '运行失败',
  [WorkflowRunStatus.Retry]: '重试中',
  [WorkflowRunStatus.Stopped]: '已停止',
  [WorkflowRunStatus.Cancelled]: '已取消',
  [WorkflowRunStatus.Paused]: '已暂停',
}

const statusToneClass: Partial<Record<WorkflowRunStatus, string>> = {
  [WorkflowRunStatus.Running]: 'text-blue-700 bg-blue-50 ring-blue-100',
  [WorkflowRunStatus.Succeeded]: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
  [WorkflowRunStatus.Failed]: 'text-rose-700 bg-rose-50 ring-rose-100',
  [WorkflowRunStatus.Cancelled]: 'text-slate-600 bg-slate-100 ring-slate-200',
  [WorkflowRunStatus.Stopped]: 'text-amber-700 bg-amber-50 ring-amber-100',
}

const formatElapsed = (elapsedMs?: number) => {
  if (elapsedMs === undefined) {
    return '—'
  }

  if (elapsedMs < 1000) {
    return `${elapsedMs}ms`
  }

  return `${(elapsedMs / 1000).toFixed(2)}s`
}

export const WorkflowRunSummaryBar = ({
  run,
  isRunning = false,
  error,
  onStop,
}: {
  run?: WorkflowRunSummary | null
  isRunning?: boolean
  error?: string | null
  onStop?: () => void
}) => {
  if (!run && !error) {
    return null
  }

  const status = run?.status ?? WorkflowRunStatus.Failed
  const label = statusLabel[status] ?? status
  const tone = statusToneClass[status] ?? 'text-slate-700 bg-white ring-slate-200'

  return (
    <div className="pointer-events-auto absolute inset-x-4 bottom-4 z-30 flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur">
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone}`}>
        {isRunning ? '运行中' : label}
      </span>

      {run?.elapsedMs !== undefined || isRunning ? (
        <span className="text-[11px] font-medium text-slate-500">
          耗时
          {' '}
          {formatElapsed(run?.elapsedMs)}
        </span>
      ) : null}

      {error ? (
        <span className="min-w-0 flex-1 truncate text-[11px] text-rose-600" title={error}>
          {error}
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">
          {run?.runId ? `Run ${run.runId}` : ''}
        </span>
      )}

      {isRunning && onStop ? (
        <button
          type="button"
          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          onClick={onStop}
        >
          停止
        </button>
      ) : null}
    </div>
  )
}

export default WorkflowRunSummaryBar
