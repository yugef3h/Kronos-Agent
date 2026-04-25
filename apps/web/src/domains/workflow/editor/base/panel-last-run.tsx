import React, { useCallback, useState } from 'react'
import PanelAlert from './panel-alert'
import { PanelCard } from './panel-form'
import type { NodeLastRunSnapshot } from '../types/run'
import {
  buildPanelLastRunMeta,
  stripEndDebugMetaFromOutputs,
  stringifyPanelLastRunPayload,
} from './panel-last-run-utils'

export type PanelLastRunProps = {
  lastRun?: NodeLastRunSnapshot | null
  emptyTitle?: string
  emptyDescription?: string
  showInputs?: boolean
  /** 输出 JSON 中隐藏 End 调试用的 `_debug` 字段 */
  stripOutputDebugMeta?: boolean
}

const JsonBlock = ({
  title,
  payload,
}: {
  title: string
  payload: Record<string, unknown> | undefined
}) => {
  const [copied, setCopied] = useState(false)
  const text = stringifyPanelLastRunPayload(payload)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }, [text])

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <button
          type="button"
          onClick={() => {
            void handleCopy()
          }}
          className="shrink-0 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="max-h-48 max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-5 text-slate-800">
        {text}
      </pre>
    </div>
  )
}

export const PanelLastRun = ({
  lastRun,
  emptyTitle = '暂无最近一次运行记录',
  emptyDescription = '单节点调试或工作流运行后，这里会展示该节点的输入、输出与耗时。',
  showInputs = true,
  stripOutputDebugMeta = false,
}: PanelLastRunProps) => {
  if (!lastRun) {
    return (
      <PanelCard className="min-w-0 space-y-1.5 overflow-hidden bg-slate-50/70 p-3">
        <p className="text-[12px] font-semibold text-slate-800">{emptyTitle}</p>
        <p className="break-words text-[11px] leading-5 text-slate-500">{emptyDescription}</p>
      </PanelCard>
    )
  }

  const meta = buildPanelLastRunMeta(lastRun)
  const outputPayload = stripOutputDebugMeta
    ? stripEndDebugMetaFromOutputs(lastRun.outputs)
    : lastRun.outputs

  return (
    <div className="min-w-0 space-y-3">
      <PanelCard className="min-w-0 space-y-2 overflow-hidden bg-slate-50/70 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.statusClassName}`}
          >
            {meta.statusLabel}
          </span>
          <span className="text-[11px] text-slate-500">
            耗时 {meta.elapsedLabel}
          </span>
          <span className="text-[11px] text-slate-500">
            完成于 {meta.finishedAtLabel}
          </span>
          {lastRun.iterationIndex !== undefined ? (
            <span className="text-[11px] text-slate-500">
              迭代 #{lastRun.iterationIndex + 1}
            </span>
          ) : null}
        </div>
        {lastRun.runId ? (
          <p className="truncate text-[11px] text-slate-400" title={lastRun.runId}>
            runId: {lastRun.runId}
          </p>
        ) : null}
      </PanelCard>

      {lastRun.error ? (
        <PanelAlert type="warning">
          <p className="font-semibold">{lastRun.error.message}</p>
          {lastRun.error.code ? (
            <p className="mt-0.5 text-[11px] opacity-80">{lastRun.error.code}</p>
          ) : null}
        </PanelAlert>
      ) : null}

      {showInputs ? <JsonBlock title="输入" payload={lastRun.inputs} /> : null}
      <JsonBlock title="输出" payload={outputPayload} />
    </div>
  )
}

export default PanelLastRun
