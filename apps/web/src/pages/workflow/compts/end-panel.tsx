import React, { useEffect, useMemo, useState } from 'react'
import { useNodes, useReactFlow } from 'reactflow'
import type { PanelProps as NodePanelProps } from './custom-node'
import AddItemButton from '../base/add-item-button'
import Field from '../base/field'
import PanelAlert from '../base/panel-alert'
import VariableSelect from '../base/variable-select'
import {
  PanelCard,
  PanelChoiceGroup,
  PanelInput,
  PanelOutputVarRow,
  PanelSection,
  PanelTextarea,
  PanelToken,
} from '../base/panel-form'
import type { Edge } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import { useEndPanelConfig } from '../features/end-panel/use-end-panel-config'
import { buildEndNodeOutputs, buildEndOutputTypes } from '../features/end-panel/schema'
import { buildWorkflowVariableOptions, serializeValueSelector } from '../utils/variable-options'
import type { VariableOption } from '../features/llm-panel/types'
import type { EndOutputConstantType } from '../features/end-panel/types'

const END_CONSTANT_TYPE_OPTIONS: Array<{ label: string; value: EndOutputConstantType }> = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'JSON', value: 'json' },
]

const findVariableOption = (valueSelector: string[], options: VariableOption[]) => {
  const serialized = serializeValueSelector(valueSelector)
  return options.find(option => serializeValueSelector(option.valueSelector) === serialized)
}

const EndPanel = ({ id, data }: NodePanelProps) => {
  const { setNodes } = useReactFlow<CanvasNodeData, Edge>()
  const nodes = useNodes<CanvasNodeData>()
  const nodeData = data as CanvasNodeData
  const [activeTab, setActiveTab] = useState<'settings' | 'last-run'>('settings')

  const variableOptions = useMemo(
    () => buildWorkflowVariableOptions(id, nodes.map(node => ({ id: node.id, data: node.data, parentId: node.parentId }))),
    [id, nodes],
  )

  const {
    config,
    issues,
    handleAddOutput,
    handleUpdateOutput,
    handleRemoveOutput,
    handleMoveOutput,
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
              工作流执行后，这里会展示最终返回值映射和每个输出项的实际结果摘要。
            </p>
          </PanelCard>
        ) : null}
      </div>

      {activeTab === 'settings' ? (
        <>
          <PanelSection title="输出映射">
            {issues.length ? <PanelAlert type="warning">{issues[0].message}</PanelAlert> : null}

            {config.outputs.length ? (
              <div className="space-y-2">
                {config.outputs.map((output, index) => (
                  <PanelCard key={output.id} className="space-y-2.5 border-[#e8edf5] bg-white p-2.5 shadow-none">
                    <div className="flex items-center gap-1.5">
                      <PanelToken>{output.variable_type === 'variable' ? '引用变量' : '常量'}</PanelToken>
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveOutput(output.id, 'up')}
                          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          disabled={index === config.outputs.length - 1}
                          onClick={() => handleMoveOutput(output.id, 'down')}
                          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          下移
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveOutput(output.id)}
                          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    <Field title="输出变量名" compact>
                      <PanelInput
                        value={output.variable}
                        placeholder="例如：answer"
                        onChange={event => handleUpdateOutput(output.id, { variable: event.target.value.trim() })}
                      />
                    </Field>

                    <Field title="值来源模式" compact>
                      <PanelChoiceGroup
                        size="sm"
                        value={output.variable_type}
                        options={[
                          { label: '变量', value: 'variable' },
                          { label: '常量', value: 'constant' },
                        ]}
                        onChange={value => handleUpdateOutput(output.id, { variable_type: value as 'variable' | 'constant' })}
                      />
                    </Field>

                    {output.variable_type === 'variable' ? (
                      <Field title="引用变量" compact>
                        <VariableSelect
                          value={output.value_selector}
                          options={variableOptions}
                          placeholder="选择最终返回值来源"
                          onChange={(valueSelector) => handleUpdateOutput(output.id, {
                            value_selector: valueSelector,
                          })}
                        />
                      </Field>
                    ) : (
                      <div className="space-y-2">
                        <Field title="常量类型" compact>
                          <PanelChoiceGroup
                            size="sm"
                            value={output.constant_type}
                            options={END_CONSTANT_TYPE_OPTIONS}
                            onChange={value => handleUpdateOutput(output.id, { constant_type: value as EndOutputConstantType })}
                          />
                        </Field>

                        <Field title="常量值" compact>
                          {output.constant_type === 'boolean' ? (
                            <PanelChoiceGroup
                              size="sm"
                              value={output.value === 'true' ? 'true' : 'false'}
                              options={[
                                { label: 'TRUE', value: 'true' },
                                { label: 'FALSE', value: 'false' },
                              ]}
                              onChange={value => handleUpdateOutput(output.id, { value })}
                            />
                          ) : output.constant_type === 'json' ? (
                            <PanelTextarea
                              className="min-h-[88px] px-2 py-1.5 text-[12px] leading-5"
                              value={output.value}
                              placeholder={'例如：{\n  "ok": true\n}'}
                              onChange={event => handleUpdateOutput(output.id, { value: event.target.value })}
                            />
                          ) : (
                            <PanelInput
                              type={output.constant_type === 'number' ? 'number' : 'text'}
                              value={output.value}
                              placeholder={output.constant_type === 'number' ? '输入数字' : '输入固定返回内容'}
                              onChange={event => handleUpdateOutput(output.id, { value: event.target.value })}
                            />
                          )}
                        </Field>
                      </div>
                    )}

                    {output.variable_type === 'variable' && output.value_selector.length ? (
                      <p className="text-[11px] leading-5 text-slate-500">
                        当前映射到 {findVariableOption(output.value_selector, variableOptions)?.label ?? output.value_selector.join('.')}。
                      </p>
                    ) : null}
                  </PanelCard>
                ))}
              </div>
            ) : null}

            {!config.outputs.length ? (
              <PanelCard className="bg-white p-3 shadow-none">
                <p className="text-[12px] font-semibold text-slate-800">还没有返回字段</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  添加至少一个输出映射，工作流执行完成后才能返回结构化结果。
                </p>
              </PanelCard>
            ) : null}

            <AddItemButton onClick={handleAddOutput}>+ 添加输出项</AddItemButton>
          </PanelSection>

          <PanelSection title="返回预览">
            <PanelCard className="space-y-2 bg-white p-2.5 shadow-none">
              {config.outputs.map((output) => {
                const option = findVariableOption(output.value_selector, variableOptions)

                return (
                  <PanelOutputVarRow
                    key={output.id}
                    name={output.variable || '未命名输出'}
                    type={output.variable_type === 'constant' ? output.constant_type : option?.valueType ?? 'string'}
                    description={output.variable_type === 'constant'
                      ? `固定返回当前配置的 ${output.constant_type.toUpperCase()} 常量值。`
                      : `返回上游变量 ${option?.label ?? '未选择变量'} 的结果。`}
                  />
                )
              })}
            </PanelCard>
          </PanelSection>
        </>
      ) : null}
    </div>
  )
}

export default React.memo(EndPanel)