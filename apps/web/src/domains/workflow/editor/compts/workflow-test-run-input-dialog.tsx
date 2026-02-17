import { useEffect, useMemo, useState } from 'react'
import Field from '../base/field'
import { Dialog, DialogContent, DialogTitle } from '../base/dialog'
import { PanelInput, PanelSection } from '../base/panel-form'
import {
  buildStartPanelDebugInputs,
  mergeStartPanelDebugFormValues,
  type StartPanelDebugFormValues,
} from '../panels/start-panel/debug-inputs'
import type { StartNodeConfig } from '../panels/start-panel/types'
import { getStartVariableTypeLabel } from '../panels/start-panel/schema'

export const WorkflowTestRunInputDialog = ({
  open,
  config,
  isRunning = false,
  onOpenChange,
  onRun,
}: {
  open: boolean
  config: StartNodeConfig
  isRunning?: boolean
  onOpenChange: (open: boolean) => void
  onRun: (inputs: Record<string, unknown>) => void
}) => {
  const [values, setValues] = useState<StartPanelDebugFormValues>({ query: '' })

  useEffect(() => {
    if (!open) {
      return
    }

    setValues((current) => mergeStartPanelDebugFormValues(config, current))
  }, [config, open])

  const canSubmit = useMemo(() => !isRunning, [isRunning])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[480px] max-w-[calc(100vw-1rem)] overflow-hidden p-0">
        <form
          className="flex flex-col overflow-hidden rounded-2xl bg-white"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canSubmit) {
              return
            }

            onRun(buildStartPanelDebugInputs(config, values))
          }}
        >
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
            <DialogTitle>
              <span className="block text-[14px] font-semibold text-slate-900">测试运行输入</span>
            </DialogTitle>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              填写开始节点的测试变量，留空则使用默认值。
            </p>
          </div>

          <div className="max-h-[min(60vh,420px)] space-y-3 overflow-y-auto px-4 py-3">
            <PanelSection title="系统变量">
              <Field title="sys.query" compact>
                <PanelInput
                  value={values.query ?? ''}
                  placeholder="用户输入"
                  onChange={(event) => setValues((current) => ({
                    ...current,
                    query: event.target.value,
                  }))}
                />
              </Field>
            </PanelSection>

            {config.variables.length > 0 ? (
              <PanelSection title="自定义变量">
                <div className="space-y-2">
                  {config.variables.map((variable) => {
                    const key = variable.variable.trim()
                    if (!key) {
                      return null
                    }

                    return (
                      <Field
                        key={variable.id}
                        title={`${key}${variable.label ? ` · ${variable.label}` : ''}`}
                        compact
                      >
                        <PanelInput
                          value={values[key] ?? ''}
                          placeholder={getStartVariableTypeLabel(variable.type)}
                          onChange={(event) => setValues((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))}
                        />
                      </Field>
                    )
                  })}
                </div>
              </PanelSection>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-100"
              onClick={() => onOpenChange(false)}
              disabled={isRunning}
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSubmit}
            >
              {isRunning ? '运行中…' : '开始运行'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default WorkflowTestRunInputDialog
