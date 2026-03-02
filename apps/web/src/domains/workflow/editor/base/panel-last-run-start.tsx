import { PanelCard } from './panel-form'
import type { NodeLastRunSnapshot } from '../types/run'

const formatValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '—'
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export const PanelLastRunStartDetails = ({ lastRun }: { lastRun: NodeLastRunSnapshot }) => {
  const inputs = lastRun.inputs ?? {}
  const outputs = lastRun.outputs ?? {}

  const query =
    typeof inputs.query === 'string'
      ? inputs.query
      : typeof outputs['sys.query'] === 'string'
        ? outputs['sys.query']
        : undefined

  const customInputKeys = Object.keys(inputs).filter((key) => key !== 'query' && key !== 'files')
  const sysOutputKeys = ['sys.query', 'sys.files', 'sys.conversation_id'].filter(
    (key) => outputs[key] !== undefined,
  )

  return (
    <PanelCard className="space-y-3 bg-slate-50/70 p-3">
      <p className="text-[11px] font-semibold text-slate-800">入口变量</p>
      {query ? (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-slate-500">用户问题 (query)</p>
          <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] leading-5 text-slate-800">
            {query}
          </p>
        </div>
      ) : null}
      {customInputKeys.length > 0 ? (
        <div className="space-y-1.5">
          {customInputKeys.map((key) => (
            <div key={key} className="space-y-1">
              <p className="text-[10px] font-medium text-slate-500">{key}</p>
              <pre className="max-h-32 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-[11px] leading-5 text-slate-800">
                {formatValue(inputs[key])}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
      {sysOutputKeys.length > 0 ? (
        <div className="space-y-1.5 border-t border-slate-200/80 pt-2">
          <p className="text-[11px] font-semibold text-slate-800">系统变量注入</p>
          {sysOutputKeys.map((key) => (
            <div key={key} className="space-y-1">
              <p className="text-[10px] font-medium text-slate-500">{key}</p>
              <pre className="max-h-24 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-[11px] leading-5 text-slate-800">
                {formatValue(outputs[key])}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </PanelCard>
  )
}
