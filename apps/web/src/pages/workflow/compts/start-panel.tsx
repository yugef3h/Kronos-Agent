import React, { useEffect, useState } from 'react'
import { useReactFlow } from 'reactflow'
import type { PanelProps as NodePanelProps } from './custom-node'
import AddItemButton from '../base/add-item-button'
import Field from '../base/field'
import PanelAlert from '../base/panel-alert'
import {
  PanelCard,
  // PanelChoiceGroup,
  PanelInput,
  PanelOutputVarRow,
  PanelSection,
  PanelSelect,
  PanelToken,
  PanelToggle,
} from '../base/panel-form'
import type { Edge } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import {
  buildStartNodeOutputs,
  buildStartOutputTypes,
  getStartVariableTypeLabel,
  START_SYSTEM_VARIABLES,
} from '../features/start-panel/schema'
import { useStartPanelConfig } from '../features/start-panel/use-start-panel-config'
import type { StartVariableType } from '../features/start-panel/types'
import { rewriteNodesVariableReferences } from '../utils/workflow-variable-references'

const START_VARIABLE_TYPE_OPTIONS: Array<{ label: string; value: StartVariableType }> = [
  { label: 'Text', value: 'text-input' },
  { label: 'Paragraph', value: 'paragraph' },
  { label: 'Select', value: 'select' },
  { label: 'Number', value: 'number' },
  { label: 'URL', value: 'url' },
  { label: 'JSON', value: 'json' },
  { label: 'Object', value: 'json_object' },
  { label: 'File', value: 'file' },
  { label: 'File List', value: 'file-list' },
  { label: 'Boolean', value: 'checkbox' },
]

const StartPanel = ({ id, data }: NodePanelProps) => {
  const { setNodes } = useReactFlow<CanvasNodeData, Edge>()
  const nodeData = data as CanvasNodeData
  const [activeTab, setActiveTab] = useState<'settings' | 'last-run'>('settings')

  const {
    config,
    issues,
    handleAddVariable,
    handleUpdateVariable,
    handleRemoveVariable,
    handleMoveVariable,
  } = useStartPanelConfig({
    value: nodeData.inputs,
    onChange: (nextValue, meta) => {
      const nextOutputs = buildStartNodeOutputs(nextValue)
      const nextInputs = {
        ...nextValue,
        _outputTypes: buildStartOutputTypes(nextValue),
      }

      setNodes((nodes) => {
        const nextNodes = nodes.map((node) => {
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
        })

        if (meta?.type === 'rename-variable') {
          return rewriteNodesVariableReferences(
            nextNodes,
            [id, meta.previousVariable],
            [id, meta.nextVariable],
            id,
          )
        }

        if (meta?.type === 'remove-variable') {
          return rewriteNodesVariableReferences(
            nextNodes,
            [id, meta.variable],
            null,
            id,
          )
        }

        return nextNodes
      })
    },
  })

  useEffect(() => {
    const rawInputs = JSON.stringify(nodeData.inputs ?? null)
    const normalizedInputs = JSON.stringify({
      ...config,
      _outputTypes: buildStartOutputTypes(config),
    })
    const rawOutputs = JSON.stringify(nodeData.outputs ?? null)
    const normalizedOutputs = JSON.stringify(buildStartNodeOutputs(config))

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
              _outputTypes: buildStartOutputTypes(config),
            } as unknown as Record<string, unknown>,
            outputs: buildStartNodeOutputs(config),
          },
        }
      }))
    }
  }, [config, id, nodeData.inputs, nodeData.outputs, setNodes])

  return (
    <div className="space-y-3">
      <div className="space-y-2 border-b border-slate-100 pb-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-0.5">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-900 shadow-[0_6px_14px_rgba(15,23,42,0.08)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              设置
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('last-run')}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                activeTab === 'last-run'
                  ? 'bg-white text-slate-900 shadow-[0_6px_14px_rgba(15,23,42,0.08)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              上次运行
            </button>
          </div>
        </div>

        {activeTab === 'last-run' ? (
          <PanelCard className="space-y-1.5 bg-slate-50/70 p-3">
            <p className="text-[12px] font-semibold text-slate-800">暂无最近一次运行记录</p>
            <p className="text-[11px] leading-5 text-slate-500">
              工作流运行后，这里会显示入口变量实际取值、系统变量注入结果和校验摘要。
            </p>
          </PanelCard>
        ) : null}
      </div>

      {activeTab === 'settings' ? (
        <>
          <PanelSection title="系统变量">
            <PanelCard className="space-y-2 bg-white p-2.5 shadow-none">
              {START_SYSTEM_VARIABLES.map((item) => (
                <PanelOutputVarRow
                  key={item.variable}
                  name={item.variable}
                  type={item.type}
                  description={item.description}
                />
              ))}
            </PanelCard>
          </PanelSection>

          <PanelSection title="自定义输入变量">
            {issues.length ? <PanelAlert type="warning">{issues[0].message}</PanelAlert> : null}
            {config.variables.length ? (
              <div className="space-y-2">
                {config.variables.map((variable, index) => (
                  <PanelCard key={variable.id} className="space-y-2.5 border-[#e8edf5] bg-white p-2.5 shadow-none">
                    <div className="flex items-center gap-1.5">
                      <PanelToken>{getStartVariableTypeLabel(variable.type)}</PanelToken>
                      {variable.required ? <PanelToken className="border-amber-200 text-amber-700">必填</PanelToken> : null}
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveVariable(variable.id, 'up')}
                          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          disabled={index === config.variables.length - 1}
                          onClick={() => handleMoveVariable(variable.id, 'down')}
                          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          下移
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariable(variable.id)}
                          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-1.5 md:grid-cols-[minmax(0,1fr)_132px]">
                      <PanelInput
                        value={variable.label}
                        placeholder="展示名称，例如：城市"
                        onChange={event => handleUpdateVariable(variable.id, { label: event.target.value })}
                      />
                      <PanelSelect
                        value={variable.type}
                        onChange={event => handleUpdateVariable(variable.id, { type: event.target.value as StartVariableType })}
                      >
                        {START_VARIABLE_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </PanelSelect>
                    </div>

                    <Field title="变量名" compact>
                      <PanelInput
                        value={variable.variable}
                        placeholder="例如：city"
                        onChange={event => handleUpdateVariable(variable.id, { variable: event.target.value })}
                      />
                    </Field>

                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                      <div>
                        <p className="text-[12px] font-semibold text-slate-800">是否必填</p>
                        <p className="text-[10px] text-slate-500">开启后可在执行前进行基础校验。</p>
                      </div>
                      <PanelToggle checked={variable.required} onChange={(checked) => handleUpdateVariable(variable.id, { required: checked })} />
                    </div>

                    {variable.type === 'select' ? (
                      <Field title="选项" compact>
                        <PanelInput
                          value={variable.options.join(', ')}
                          placeholder="使用英文逗号分隔，例如：beijing, shanghai"
                          onChange={event => handleUpdateVariable(variable.id, {
                            options: event.target.value.split(',').map(item => item.trim()).filter(Boolean),
                          })}
                        />
                      </Field>
                    ) : null}

                    <div className="grid gap-1.5 md:grid-cols-2">
                      <Field title="占位提示" compact>
                        <PanelInput
                          value={variable.placeholder}
                          placeholder="可选"
                          onChange={event => handleUpdateVariable(variable.id, { placeholder: event.target.value })}
                        />
                      </Field>
                      <Field title="说明" compact>
                        <PanelInput
                          value={variable.hint}
                          placeholder="给调用方的输入说明"
                          onChange={event => handleUpdateVariable(variable.id, { hint: event.target.value })}
                        />
                      </Field>
                    </div>
                  </PanelCard>
                ))}
              </div>
            ) : (
              <PanelCard className="bg-white p-3 shadow-none">
                <p className="text-[12px] font-semibold text-slate-800">还没有自定义输入变量</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  如果你的工作流需要除系统变量之外的额外入口参数，可以在这里声明并暴露给下游节点。
                </p>
              </PanelCard>
            )}

            <AddItemButton onClick={handleAddVariable}>+ 添加输入变量</AddItemButton>
          </PanelSection>

          <PanelSection title="输出预览">
            <PanelCard className="space-y-2 bg-white p-2.5 shadow-none">
              <PanelOutputVarRow name="query" type="string" description="系统注入的用户输入文本。" />
              <PanelOutputVarRow name="files" type="file[]" description="系统注入的文件列表。" />
              {config.variables.map((variable) => (
                <PanelOutputVarRow
                  key={variable.id}
                  name={variable.variable || '未命名变量'}
                  type={getStartVariableTypeLabel(variable.type)}
                  description={variable.hint || `${variable.label || '自定义变量'} 会作为 Start 节点输出暴露给下游。`}
                />
              ))}
            </PanelCard>
          </PanelSection>
        </>
      ) : null}
    </div>
  )
}

export default React.memo(StartPanel)