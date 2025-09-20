import React, { useEffect, useMemo, useState } from 'react'
import { useReactFlow } from 'reactflow'
import type { PanelProps as NodePanelProps } from './custom-node'
import VariableSelect from '../base/variable-select'
import Field from '../base/field'
import PanelAlert from '../base/panel-alert'
import {
  PanelCard,
  PanelChoiceGroup,
  PanelOutputVarRow,
  PanelSection,
  PanelSliderInput,
  PanelToken,
  PanelToggle,
} from '../base/panel-form'
import type { Edge } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import { getIterationErrorHandleLabel, getIterationOutputTypeLabel } from '../features/iteration-panel/schema'
import { useIterationPanelConfig } from '../features/iteration-panel/use-iteration-panel-config'
import type { IterationErrorHandleMode, IterationNodeConfig } from '../features/iteration-panel/types'
import type { VariableOption } from '../features/llm-panel/types'
import { buildWorkflowVariableOptions, serializeValueSelector } from '../utils/variable-options'

const ITERATION_ERROR_MODE_OPTIONS: Array<{ label: string; value: IterationErrorHandleMode }> = [
  { label: '终止', value: 'terminated' },
  { label: '继续', value: 'continue_on_error' },
  { label: '移除异常', value: 'remove_abnormal_output' },
]

const findVariableOption = (valueSelector: string[], options: VariableOption[]) => {
  const serialized = serializeValueSelector(valueSelector)
  return options.find(option => serializeValueSelector(option.valueSelector) === serialized)
}

const IterationPanel = ({ id, data }: NodePanelProps) => {
  const { getNodes, setNodes } = useReactFlow<CanvasNodeData, Edge>()
  const nodeData = data as CanvasNodeData
  const [activeTab, setActiveTab] = useState<'settings' | 'last-run'>('settings')

  const variableOptions = useMemo(
    () => buildWorkflowVariableOptions(id, getNodes().map(node => ({ id: node.id, data: node.data, parentId: node.parentId }))),
    [getNodes, id],
  )

  const iteratorOption = useMemo(
    () => findVariableOption((nodeData.inputs as IterationNodeConfig | undefined)?.iterator_selector ?? [], variableOptions),
    [nodeData.inputs, variableOptions],
  )

  const currentItemOption = useMemo<VariableOption>(() => ({
    label: 'current.item',
    valueSelector: [id, 'item'],
    valueType: iteratorOption?.valueSelector.join('.') === 'sys.files' ? 'file' : 'object',
    source: 'node',
  }), [id, iteratorOption?.valueSelector])

  const currentIndexOption = useMemo<VariableOption>(() => ({
    label: 'current.index',
    valueSelector: [id, 'index'],
    valueType: 'number',
    source: 'node',
  }), [id])

  const iteratorCandidates = useMemo(
    () => variableOptions.filter(option => option.valueType === 'array' || serializeValueSelector(option.valueSelector) === 'sys.files'),
    [variableOptions],
  )

  const outputCandidates = useMemo(
    () => [currentItemOption, currentIndexOption, ...variableOptions],
    [currentIndexOption, currentItemOption, variableOptions],
  )

  const {
    config,
    issues,
    handleIteratorSelectorChange,
    handleOutputSelectorChange,
    handleParallelChange,
    handleParallelNumsChange,
    handleErrorHandleModeChange,
    handleFlattenOutputChange,
  } = useIterationPanelConfig({
    nodeId: id,
    value: nodeData.inputs,
    onChange: (nextValue: IterationNodeConfig) => {
      setNodes(nodes => nodes.map((node) => {
        if (node.id !== id)
          return node

        return {
          ...node,
          data: {
            ...node.data,
            inputs: nextValue as unknown as Record<string, unknown>,
            outputs: {
              items: [],
              count: 0,
              ...(node.data.outputs ?? {}),
            },
          },
        }
      }))
    },
  })

  useEffect(() => {
    const rawInputs = JSON.stringify(nodeData.inputs ?? null)
    const normalizedInputs = JSON.stringify(config)
    const outputs = nodeData.outputs ?? {}
    const hasOutputShape = 'items' in outputs && 'count' in outputs

    if (rawInputs !== normalizedInputs || !hasOutputShape) {
      setNodes(nodes => nodes.map((node) => {
        if (node.id !== id)
          return node

        return {
          ...node,
          data: {
            ...node.data,
            inputs: config as unknown as Record<string, unknown>,
            outputs: {
              items: [],
              count: 0,
              ...(node.data.outputs ?? {}),
            },
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
              运行工作流后，这里会显示每轮迭代输入、并行度、异常处理结果和聚合后的输出摘要。
            </p>
          </PanelCard>
        ) : null}
      </div>

      {activeTab === 'settings' ? (
        <>
          <PanelSection title="容器入口">
            <PanelCard className="space-y-2 bg-white p-2.5 shadow-none">
              <div className="flex flex-wrap gap-1.5">
                <PanelToken>start: {config.start_node_id}</PanelToken>
                <PanelToken>{nodeData._children?.length ?? 1} 个内部入口节点</PanelToken>
              </div>
              <p className="text-[11px] leading-5 text-slate-500">
                当前仓库还没有容器子图编辑器，这里先稳定保存后端执行真正依赖的入口信息和聚合策略。
              </p>
            </PanelCard>
          </PanelSection>

          <PanelSection title="输入数组">
            {issues.length ? (
              <PanelAlert type="warning">{issues[0].message}</PanelAlert>
            ) : null}
            <PanelCard className="space-y-2.5 bg-white p-2.5 shadow-none">
              <Field title="迭代变量" compact>
                <VariableSelect
                  value={config.iterator_selector}
                  options={iteratorCandidates}
                  placeholder="选择一个数组变量"
                  onChange={(valueSelector) => handleIteratorSelectorChange(
                    valueSelector,
                    serializeValueSelector(valueSelector) === `${id}.item` ? currentItemOption : findVariableOption(valueSelector, iteratorCandidates),
                  )}
                />
              </Field>
              {iteratorCandidates.length ? null : (
                <PanelAlert type="warning">
                  当前画布里还没有可直接迭代的数组输出，先让上游节点产出数组后再配置 iteration。
                </PanelAlert>
              )}
            </PanelCard>
          </PanelSection>

          <PanelSection title="聚合输出">
            <PanelCard className="space-y-2.5 bg-white p-2.5 shadow-none">
              <Field title="输出变量" compact>
                <VariableSelect
                  value={config.output_selector}
                  options={outputCandidates}
                  placeholder="选择每轮聚合输出"
                  onChange={(valueSelector) => handleOutputSelectorChange(
                    valueSelector,
                    findVariableOption(valueSelector, outputCandidates),
                  )}
                />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                <PanelToken>{getIterationOutputTypeLabel(config.output_type)}</PanelToken>
                <PanelToken>{config.flatten_output ? '输出拍平' : '保持嵌套'}</PanelToken>
              </div>
              <p className="text-[11px] leading-5 text-slate-500">
                默认推荐聚合 `current.item`。如果后续接入容器子图，可将输出切到子节点返回值。
              </p>
            </PanelCard>
          </PanelSection>

          <PanelSection title="执行策略">
            <PanelCard className="space-y-2.5 bg-white p-2.5 shadow-none">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                <div>
                  <p className="text-[12px] font-semibold text-slate-800">并行执行</p>
                  <p className="text-[10px] text-slate-500">后端会按并行度启动多轮子图执行。</p>
                </div>
                <PanelToggle checked={config.is_parallel} onChange={handleParallelChange} />
              </div>

              {config.is_parallel ? (
                <Field title="最大并行数" compact>
                  <PanelSliderInput
                    min={1}
                    max={50}
                    step={1}
                    value={config.parallel_nums}
                    onChange={handleParallelNumsChange}
                  />
                </Field>
              ) : null}

              <Field title="错误处理" compact>
                <PanelChoiceGroup
                  size="sm"
                  value={config.error_handle_mode}
                  options={ITERATION_ERROR_MODE_OPTIONS}
                  onChange={value => handleErrorHandleModeChange(value as IterationErrorHandleMode)}
                />
              </Field>
              <p className="text-[11px] text-slate-500">当前模式：{getIterationErrorHandleLabel(config.error_handle_mode)}</p>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                <div>
                  <p className="text-[12px] font-semibold text-slate-800">拍平输出</p>
                  <p className="text-[10px] text-slate-500">当每轮本身输出数组时，决定是否合并成一层列表。</p>
                </div>
                <PanelToggle checked={config.flatten_output} onChange={handleFlattenOutputChange} />
              </div>
            </PanelCard>
          </PanelSection>

          <PanelSection title="输出变量">
            <PanelCard className="space-y-2 bg-white p-2.5 shadow-none">
              <PanelOutputVarRow
                name="items"
                type={getIterationOutputTypeLabel(config.output_type)}
                description="Iteration 聚合输出。后端会按顺序或并行结果汇总为数组。"
              />
              <PanelOutputVarRow
                name="count"
                type="Number"
                description="实际执行完成的轮次数，可用于后续统计或判断。"
              />
            </PanelCard>
          </PanelSection>
        </>
      ) : null}
    </div>
  )
}

export default React.memo(IterationPanel)