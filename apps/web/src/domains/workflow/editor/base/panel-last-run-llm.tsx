import { PanelCard } from './panel-form'
import type { NodeLastRunSnapshot } from '../types/run'

type LlmDebugOutputs = {
  text?: string
  reasoning_content?: string
  usage?: Record<string, unknown>
}

export const PanelLastRunLlmDetails = ({ lastRun }: { lastRun: NodeLastRunSnapshot }) => {
  const outputs = lastRun.outputs as LlmDebugOutputs | undefined
  const text = typeof outputs?.text === 'string' ? outputs.text : ''

  if (!text && !outputs?.usage) {
    return null
  }

  return (
    <PanelCard className="space-y-2 bg-slate-50/70 p-3">
      {text ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">模型输出</p>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-5 text-slate-800">
            {text}
          </pre>
        </div>
      ) : null}
      {outputs?.usage && Object.keys(outputs.usage).length > 0 ? (
        <p className="text-[11px] text-slate-500">
          Token usage:
          {' '}
          {JSON.stringify(outputs.usage)}
        </p>
      ) : null}
    </PanelCard>
  )
}
