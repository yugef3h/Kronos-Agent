import { NodeRunningStatus } from '../types/common'

const statusLabel: Partial<Record<NodeRunningStatus, string>> = {
  [NodeRunningStatus.Running]: '运行中',
  [NodeRunningStatus.Succeeded]: '成功',
  [NodeRunningStatus.Failed]: '失败',
  [NodeRunningStatus.Exception]: '异常',
  [NodeRunningStatus.Stopped]: '已停止',
  [NodeRunningStatus.Waiting]: '等待',
}

export const NodeRunStatusIcon = ({
  status,
  className = '',
}: {
  status?: NodeRunningStatus
  className?: string
}) => {
  if (!status || status === NodeRunningStatus.NotStart) {
    return null
  }

  const label = statusLabel[status] ?? status

  if (status === NodeRunningStatus.Running) {
    return (
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center ${className}`}
        title={label}
        aria-label={label}
      >
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      </span>
    )
  }

  if (status === NodeRunningStatus.Succeeded) {
    return (
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ${className}`}
        title={label}
        aria-label={label}
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" />
        </svg>
      </span>
    )
  }

  if (
    status === NodeRunningStatus.Failed
    || status === NodeRunningStatus.Exception
    || status === NodeRunningStatus.Stopped
  ) {
    return (
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ${className}`}
        title={label}
        aria-label={label}
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M10 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1zm0 8a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z" />
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-1.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z" clipRule="evenodd" />
        </svg>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 px-1 text-[9px] font-semibold text-slate-600 ${className}`}
      title={label}
      aria-label={label}
    >
      …
    </span>
  )
}

export default NodeRunStatusIcon
