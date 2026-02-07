import { PanelCard } from './panel-form'
import type { NodeLastRunSnapshot } from '../types/run'

type IfElseDebugOutputs = {
  branchId?: string
  caseIndex?: number
  isElse?: boolean
  evaluations?: Array<{
    case_id: string
    case_index: number
    matched: boolean
    conditions: Array<{
      id: string
      variable_selector: string[]
      comparison_operator: string
      expected_value: string
      actual_value: unknown
      matched: boolean
    }>
  }>
}

export const PanelLastRunIfElseDetails = ({ lastRun }: { lastRun: NodeLastRunSnapshot }) => {
  const outputs = lastRun.outputs as IfElseDebugOutputs | undefined
  if (!outputs?.branchId) {
    return null
  }

  return (
    <PanelCard className="space-y-2 bg-slate-50/70 p-3">
      <p className="text-[12px] font-semibold text-slate-800">
        命中分支：{outputs.isElse ? 'ELSE' : `CASE ${(outputs.caseIndex ?? 0) + 1}`}
      </p>
      <p className="text-[11px] text-slate-500">branchId: {outputs.branchId}</p>
      {outputs.evaluations?.length ? (
        <div className="space-y-1.5">
          {outputs.evaluations.map((evaluation) => (
            <div
              key={evaluation.case_id}
              className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                evaluation.matched
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <p className="font-semibold">
                {evaluation.matched ? '✓ ' : ''}
                Case {evaluation.case_index + 1}
              </p>
              {evaluation.conditions.map((condition) => (
                <p key={condition.id} className="mt-0.5 text-[10px] opacity-90">
                  {condition.variable_selector.join('.')}
                  {' '}
                  {condition.comparison_operator}
                  {' '}
                  {String(condition.expected_value)}
                  {' → '}
                  {String(condition.actual_value)}
                  {condition.matched ? ' (match)' : ''}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </PanelCard>
  )
}
