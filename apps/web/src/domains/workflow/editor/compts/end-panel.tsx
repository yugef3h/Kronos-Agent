import React, { useCallback, useEffect, useMemo } from 'react'
import { useWorkflowCanvasNodes } from '../context/workflow-canvas-nodes-context'
import type { PanelProps as NodePanelProps } from './custom-node'
import PanelAlert from '../base/panel-alert'
import VariableSelect from '../../../../components/form/variable-select'
import {
  PanelInput,
  PanelSection,
  usePanelTabs,
} from '../base/panel-form'
import PanelLastRun from '../base/panel-last-run'
import { PanelLastRunEndDetails } from '../base/panel-last-run-end'
import { useRegisterPanelNodeDebug } from '../base/panel-node-debug-context'
import type { CanvasNodeData } from '../types/canvas'
import { useEndPanelConfig } from '../panels/end-panel/use-end-panel-config'
import { buildEndNodeOutputs, buildEndOutputTypes } from '../panels/end-panel/schema'
import { buildWorkflowVariableOptions } from '../utils/variable-options'
import { useNodeDebugRun } from '../hooks/use-node-debug-run'
import { useWorkflowAppId } from '../hooks/use-workflow-app-id'
import { resolveNodeLastRun } from '../utils/resolve-node-last-run'

const EndPanel = ({ id, data }: NodePanelProps) => {
  const { setNodes, nodes, edges } = useWorkflowCanvasNodes()
  const appId = useWorkflowAppId()
  const nodeData = data as CanvasNodeData
  const { activeTab } = usePanelTabs()

  const variableOptions = useMemo(
    () => buildWorkflowVariableOptions(id, nodes.map(node => ({ id: node.id, data: node.data, parentId: node.parentId })), edges),
    [edges, id, nodes],
  )

  const {
    config,
    issues,
    handleAddOutput,
    handleUpdateOutput,
    handleRemoveOutput,
  } = useEndPanelConfig({
    value: nodeData.inputs,
    existingOutputs: nodeData.outputs,
    onChange: (nextValue) => {
      const nextOutputs = buildEndNodeOutputs(nextValue)
      const nextInputs = {
        ...nextValue,
        _outputTypes: buildEndOutputTypes(nextValue, variableOptions),
      }

      setNodes((nodes) => nodes.map((node) => {
        if (node.id !== id)
          return node

        return {
          ...node,
          data: {
            ...node.data,
            inputs: nextInputs as unknown as Record<string, unknown>,
            outputs: nextOutputs,
          },
        }
      }))
    },
  })

  const { runDebug, isRunning, error, clearError } = useNodeDebugRun({
    appId,
    nodeId: id,
    nodeKind: 'end',
    nodeInputs: config as unknown as Record<string, unknown>,
    nodeOutputs: nodeData.outputs,
  })

  const handleRunDebug = useCallback(() => {
    clearError()
    void runDebug()
  }, [clearError, runDebug])

  useRegisterPanelNodeDebug(id, {
    runDebug: handleRunDebug,
    isRunning,
    disabled: issues.length > 0,
  })

  useEffect(() => {
    const rawInputs = JSON.stringify(nodeData.inputs ?? null)
    const normalizedInputs = JSON.stringify({
      ...config,
      _outputTypes: buildEndOutputTypes(config, variableOptions),
    })
    const rawOutputs = JSON.stringify(nodeData.outputs ?? null)
    const normalizedOutputs = JSON.stringify(buildEndNodeOutputs(config))

    if (rawInputs !== normalizedInputs || rawOutputs !== normalizedOutputs) {
      setNodes((nodes) => nodes.map((node) => {
        if (node.id !== id)
          return node

        return {
          ...node,
          data: {
            ...node.data,
            inputs: {
              ...config,
              _outputTypes: buildEndOutputTypes(config, variableOptions),
            } as unknown as Record<string, unknown>,
            outputs: buildEndNodeOutputs(config),
          },
        }
      }))
    }
  }, [config, id, nodeData.inputs, nodeData.outputs, setNodes, variableOptions])

  const lastRun = resolveNodeLastRun(id, nodeData)

  return (
    <div className="space-y-3">
      {activeTab === 'last-run' ? (
        <PanelSection title="运行结果">
          {lastRun ? <PanelLastRunEndDetails lastRun={lastRun} /> : null}
          <PanelLastRun
            lastRun={lastRun}
            stripOutputDebugMeta
            emptyDescription="工作流测试运行完成后，这里会展示 End 节点的输入、输出与耗时。"
          />
          {error ? <PanelAlert type="warning">{error}</PanelAlert> : null}
        </PanelSection>
      ) : null}

      {activeTab === 'settings' ? (
        <PanelSection
          title="输出变量"
          required
          aside={
            <button
              type="button"
              onClick={handleAddOutput}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-[15px] text-slate-600 transition hover:bg-[#c8ceda33]"
              aria-label="新增输出变量"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </button>
          }
        >
          {issues.length ? <PanelAlert type="warning">{issues[0].message}</PanelAlert> : null}

          {config.outputs.length ? (
            <div className="space-y-1.5">
              {config.outputs.map((output) => (
                <div
                  key={output.id}
                  className="grid grid-cols-[minmax(112px,132px)_minmax(0,1fr)_32px] items-center gap-2"
                >
                  <PanelInput
                    value={output.variable}
                    placeholder="变量名"
                    className="border-transparent bg-[#f0f2f6]"
                    onChange={event => handleUpdateOutput(output.id, {
                      variable: event.target.value,
                      variable_type: 'variable',
                    })}
                  />

                  <div className="rounded-[12px] border border-[#e9edf4] bg-[#f7f9fc] p-[1px]">
                    <VariableSelect
                      value={output.value_selector}
                      options={variableOptions}
                      placeholder="设置变量值"
                      onChange={(valueSelector) => handleUpdateOutput(output.id, {
                        variable_type: 'variable',
                        value_selector: valueSelector,
                      })}
                    />
                  </div>

                  <button
                    type="button"
                    aria-label="删除输出变量"
                    onClick={() => handleRemoveOutput(output.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-4 w-4 text-text-tertiary group-hover:text-text-destructive hover:text-rose-600"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z"></path></svg>
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </PanelSection>
      ) : null}
    </div>
  )
}

export default React.memo(EndPanel)
