import { NodeRunningStatus } from '../types/common'
import type { NodeLastRunSnapshot } from '../types/run'

export const formatPanelLastRunTimestamp = (value?: number): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export const formatPanelLastRunElapsed = (elapsedMs?: number): string => {
  if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs)) {
    return '—'
  }

  if (elapsedMs < 1000) {
    return `${elapsedMs} ms`
  }

  return `${(elapsedMs / 1000).toFixed(2)} s`
}

export const formatNodeRunStatusLabel = (status: NodeRunningStatus): string => {
  switch (status) {
    case NodeRunningStatus.Succeeded:
      return '成功'
    case NodeRunningStatus.Failed:
      return '失败'
    case NodeRunningStatus.Exception:
      return '异常'
    case NodeRunningStatus.Running:
      return '运行中'
    case NodeRunningStatus.Waiting:
      return '等待中'
    case NodeRunningStatus.Stopped:
      return '已停止'
    case NodeRunningStatus.Paused:
      return '已暂停'
    case NodeRunningStatus.Retry:
      return '重试中'
    case NodeRunningStatus.Listening:
      return '监听中'
    case NodeRunningStatus.NotStart:
    default:
      return '未开始'
  }
}

export const nodeRunStatusBadgeClassName = (status: NodeRunningStatus): string => {
  switch (status) {
    case NodeRunningStatus.Succeeded:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case NodeRunningStatus.Failed:
    case NodeRunningStatus.Exception:
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case NodeRunningStatus.Running:
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case NodeRunningStatus.Stopped:
    case NodeRunningStatus.Paused:
      return 'border-amber-200 bg-amber-50 text-amber-800'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

/** End 节点输出里的 `_debug` 已在 PanelLastRunEndDetails 展示，JSON 区只保留业务字段。 */
export const stripEndDebugMetaFromOutputs = (
  outputs?: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  if (!outputs) {
    return undefined
  }

  const { _debug, ...rest } = outputs
  void _debug

  return Object.keys(rest).length > 0 ? rest : outputs
}

export const stringifyPanelLastRunPayload = (value: unknown): string => {
  if (value === undefined) {
    return '{}'
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export const buildPanelLastRunMeta = (lastRun: NodeLastRunSnapshot) => ({
  statusLabel: formatNodeRunStatusLabel(lastRun.status),
  statusClassName: nodeRunStatusBadgeClassName(lastRun.status),
  elapsedLabel: formatPanelLastRunElapsed(lastRun.elapsedMs),
  finishedAtLabel: formatPanelLastRunTimestamp(lastRun.finishedAt),
})
