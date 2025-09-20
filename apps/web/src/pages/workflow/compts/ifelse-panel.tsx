import React, { useEffect, useState } from 'react'
import { useReactFlow, useUpdateNodeInternals } from 'reactflow'
import type { PanelProps as NodePanelProps } from './custom-node'
import PanelAlert from '../base/panel-alert'
import VariableSelect from '../base/variable-select'
import {
  PanelCard,
  PanelChoiceGroup,
  PanelInput,
  PanelSection,
  PanelSelect,
  PanelToken,
} from '../base/panel-form'
import type { Edge } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import type { VariableOption } from '../features/llm-panel/types'
import {
  buildIfElseTargetBranches,
  comparisonOperatorRequiresValue,
  getComparisonOperatorLabel,
  getComparisonOptionsByVariableType,
  getIfElseLogicalOperatorLabel,
  getIfElseCaseLabel,
  resolveIfElseVariableLabel,
} from '../features/ifelse-panel/schema'
import { useIfElsePanelConfig } from '../features/ifelse-panel/use-ifelse-panel-config'
import type { IfElseCondition, IfElseNodeConfig } from '../features/ifelse-panel/types'

const buildVariableOptions = (
  currentNodeId: string,
  nodes: Array<{ id: string; data: CanvasNodeData }>,
): VariableOption[] => {
  const systemVariables: VariableOption[] = [
    {
      label: 'sys.query',
      valueSelector: ['sys', 'query'],
      valueType: 'string',
      source: 'system',
    },
    {
      label: 'sys.files',
      valueSelector: ['sys', 'files'],
      valueType: 'file',
      source: 'system',
    },
    {
      label: 'sys.conversation_id',
      valueSelector: ['sys', 'conversation_id'],
      valueType: 'string',
      source: 'system',
    },
  ]

  const nodeVariables = nodes
    .filter(node => node.id !== currentNodeId)
    .sort((left, right) => left.data.title.localeCompare(right.data.title, 'zh-CN'))
    .flatMap((node) => {
      const outputs = Object.keys(node.data.outputs ?? {})
      if (!outputs.length)
        return []

      return outputs.map<VariableOption>((outputKey) => ({
        label: `${node.data.title}.${outputKey}`,
        valueSelector: [node.id, outputKey],
        valueType: outputKey.includes('file')
          ? 'file'
          : outputKey === 'usage'
            ? 'object'
            : 'string',
        source: 'node',
      }))
    })

  return [...systemVariables, ...nodeVariables]
}

const serializeValueSelector = (valueSelector: string[]) => valueSelector.join('.')

const ConditionEditor = ({
  caseId,
  condition,
  variableOptions,
  onVariableChange,
  onOperatorChange,
  onValueChange,
  onRemove,
}: {
  caseId: string
  condition: IfElseCondition
  variableOptions: VariableOption[]
  onVariableChange: (caseId: string, conditionId: string, variable?: VariableOption) => void
  onOperatorChange: (caseId: string, conditionId: string, value: IfElseCondition['comparisonOperator']) => void
  onValueChange: (caseId: string, conditionId: string, value: IfElseCondition['value']) => void
  onRemove: (caseId: string, conditionId: string) => void
}) => {
  const variableLabel = resolveIfElseVariableLabel(condition.variableSelector, variableOptions)
  const operatorOptions = getComparisonOptionsByVariableType(condition.variableType)
  const requiresValue = comparisonOperatorRequiresValue(condition.comparisonOperator)

  return (
    <PanelCard className="space-y-2.5 border-[#e8edf5] bg-white p-2.5 shadow-none">
      <div className="flex items-center gap-1.5">
        <PanelToken className="border-sky-100 text-sky-600">{condition.variableType}</PanelToken>
        {condition.variableSelector.length ? (
          <span className="line-clamp-1 text-[11px] text-slate-400">{variableLabel}</span>
        ) : null}
        <button
          type="button"
          onClick={() => onRemove(caseId, condition.id)}
          className="ml-auto rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
        >
          删除
        </button>
      </div>

      <div className="grid gap-1.5 md:grid-cols-[minmax(0,1.9fr)_116px_minmax(0,0.95fr)]">
        <VariableSelect
          value={condition.variableSelector}
          options={variableOptions}
          placeholder="选择变量"
          onChange={(valueSelector) => {
            const nextVariable = variableOptions.find(
              option => serializeValueSelector(option.valueSelector) === serializeValueSelector(valueSelector),
            )
            onVariableChange(caseId, condition.id, nextVariable)
          }}
        />

        <PanelSelect
          value={condition.comparisonOperator}
          onChange={(event) => onOperatorChange(caseId, condition.id, event.target.value as IfElseCondition['comparisonOperator'])}
        >
          {operatorOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </PanelSelect>

        {requiresValue ? (
          condition.variableType === 'boolean' ? (
            <PanelChoiceGroup
              size="sm"
              value={String(condition.value === true)}
              options={[
                { label: 'TRUE', value: 'true' },
                { label: 'FALSE', value: 'false' },
              ]}
              onChange={(value) => onValueChange(caseId, condition.id, value === 'true')}
            />
          ) : (
            <PanelInput
              type={condition.variableType === 'number' ? 'number' : 'text'}
              placeholder="比较值"
              value={typeof condition.value === 'boolean' ? String(condition.value) : (condition.value ?? '')}
              onChange={(event) => {
                const nextValue = condition.variableType === 'number'
                  ? (event.target.value === '' ? '' : Number(event.target.value))
                  : event.target.value

                onValueChange(caseId, condition.id, nextValue === '' ? '' : nextValue)
              }}
            />
          )
        ) : (
          <div className="flex items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
            {getComparisonOperatorLabel(condition.comparisonOperator)} 无需比较值
          </div>
        )}
      </div>
    </PanelCard>
  )
}

const IfElsePanel = ({ id, data }: NodePanelProps) => {
  const { getNodes, setNodes, setEdges } = useReactFlow<CanvasNodeData, Edge>()
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeData = data as CanvasNodeData
  const variableOptions = buildVariableOptions(
    id,
    getNodes().map(node => ({ id: node.id, data: node.data })),
  )
  const [activeTab, setActiveTab] = useState<'settings' | 'last-run'>('settings')
  const {
    config,
    issues,
    handleAddCase,
    handleRemoveCase,
    handleMoveCase,
    handleCaseLogicalOperatorChange,
    handleAddCondition,
    handleRemoveCondition,
    handleConditionVariableChange,
    handleConditionOperatorChange,
    handleConditionValueChange,
  } = useIfElsePanelConfig({
    value: nodeData.inputs,
    onChange: (nextValue: IfElseNodeConfig) => {
      setNodes((nodes) => nodes.map((node) => {
        if (node.id !== id)
          return node

        return {
          ...node,
          data: {
            ...node.data,
            inputs: nextValue as unknown as Record<string, unknown>,
            _targetBranches: buildIfElseTargetBranches(nextValue.cases),
          },
        }
      }))
    },
  })
  const targetBranches = buildIfElseTargetBranches(config.cases)

  useEffect(() => {
    const rawInputs = JSON.stringify(nodeData.inputs ?? null)
    const normalizedInputs = JSON.stringify(config)
    const rawBranches = JSON.stringify(nodeData._targetBranches ?? [])
    const normalizedBranches = JSON.stringify(targetBranches)

    if (rawInputs !== normalizedInputs || rawBranches !== normalizedBranches) {
      setNodes((nodes) => nodes.map((node) => {
        if (node.id !== id)
          return node

        return {
          ...node,
          data: {
            ...node.data,
            inputs: config as unknown as Record<string, unknown>,
            _targetBranches: targetBranches,
          },
        }
      }))
    }
  }, [config, id, nodeData._targetBranches, nodeData.inputs, setNodes, targetBranches])

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, targetBranches.length, updateNodeInternals])

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
              运行工作流后，这里会显示条件命中的分支、输入变量和结果，便于排查 if / elif / else 的走向。
            </p>
          </PanelCard>
        ) : null}
      </div>

      {activeTab === 'settings' ? (
        <>

          {config.cases.map((caseItem, index) => (
            <PanelSection
              key={caseItem.case_id}
              title={getIfElseCaseLabel(index)}
              aside={(
                <div className="flex items-center gap-1.5">
                  {index > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleMoveCase(caseItem.case_id, 'up')}
                      className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    >
                      上移
                    </button>
                  ) : null}
                  {index < config.cases.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => handleMoveCase(caseItem.case_id, 'down')}
                      className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    >
                      下移
                    </button>
                  ) : null}
                  {index > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleRemoveCase(caseItem.case_id)
                        setEdges((edges) => edges.filter(
                          edge => !(edge.source === id && edge.sourceHandle === caseItem.case_id),
                        ))
                      }}
                      className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              )}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                  <div>
                    <p className="text-[12px] font-semibold text-slate-800">{getIfElseLogicalOperatorLabel(caseItem.logical_operator)}</p>
                    <p className="text-[10px] text-slate-400">handle: {caseItem.case_id}</p>
                  </div>
                  <PanelChoiceGroup
                    className="w-[136px]"
                    size="sm"
                    value={caseItem.logical_operator}
                    options={[
                      { label: 'AND', value: 'and' },
                      { label: 'OR', value: 'or' },
                    ]}
                    onChange={(value) => handleCaseLogicalOperatorChange(caseItem.case_id, value)}
                  />
                </div>

                {caseItem.conditions.length ? caseItem.conditions.map(condition => (
                  <ConditionEditor
                    key={condition.id}
                    caseId={caseItem.case_id}
                    condition={condition}
                    variableOptions={variableOptions}
                    onVariableChange={handleConditionVariableChange}
                    onOperatorChange={handleConditionOperatorChange}
                    onValueChange={handleConditionValueChange}
                    onRemove={handleRemoveCondition}
                  />
                )) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
                    该分支还没有条件。添加条件后，命中时将从对应 handle 输出。
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleAddCondition(caseItem.case_id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
                >
                  <span className="text-sm leading-none">+</span>
                  添加条件
                </button>
              </div>
            </PanelSection>
          ))}

          <div className="border-b border-slate-100 pb-3">
            <button
              type="button"
              onClick={handleAddCase}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/70 px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
            >
              <span className="text-sm leading-none">+</span>
              ELIF
            </button>
          </div>

          <PanelSection title="ELSE">
            <PanelCard className="space-y-1.5 bg-slate-50/80 p-3">
              <div className="flex items-center gap-1.5">
                <PanelToken className="border-slate-200 text-slate-600">ELSE</PanelToken>
                <span className="text-[10px] text-slate-400">handle: false</span>
              </div>
              <p className="text-[12px] leading-5 text-slate-600">
                用于定义当 if / elif 条件都不满足时应执行的逻辑。该分支固定存在，不在 cases 内持久化。
              </p>
            </PanelCard>
          </PanelSection>
        </>
      ) : null}
    </div>
  )
}

export default React.memo(IfElsePanel)