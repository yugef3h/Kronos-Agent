import { PanelCard } from './panel-form'
import type { NodeLastRunSnapshot } from '../types/run'

type EndDebugOutputs = {
  _debug?: {
    resolutionTrace?: Array<{
      variable: string
      source: string
      resolved: boolean
      value_selector?: string[]
    }>
    usedMockContext?: boolean
  }
}

export const PanelLastRunEndDetails = ({ lastRun }: { lastRun: NodeLastRunSnapshot }) => {
  const outputs = lastRun.outputs as EndDebugOutputs | undefined
  const trace = outputs?._debug?.resolutionTrace ?? []
  const usedMockContext = outputs?._debug?.usedMockContext

  if (!trace.length && usedMockContext === undefined) {
    return null
  }

  return (
    <PanelCard className="space-y-2 bg-slate-50/70 p-3">
      {usedMockContext !== undefined ? (
        <p className="text-[11px] leading-5 text-slate-500">
          {usedMockContext
            ? '未提供上游变量，已使用 mock 上下文解析输出映射。'
            : '已使用调试上下文变量解析输出映射。'}
        </p>
      ) : null}
      {trace.length ? (
        <div className="space-y-1.5">
          {trace.map((item) => (
            <div
              key={`${item.variable}-${item.source}`}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-700"
            >
              <p className="font-semibold text-slate-800">{item.variable}</p>
              <p className="text-slate-500">
                {item.source}
                {item.resolved ? ' · 已解析' : ' · mock'}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </PanelCard>
  )
}
