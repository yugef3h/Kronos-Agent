import React, { useEffect } from 'react'
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
  getComparisonOptionsByVariableType,
  getIfElseCaseLabel,
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
  const selectedValue = serializeValueSelector(condition.variableSelector)
  const selectedVariable = variableOptions.find(
    option => serializeValueSelector(option.valueSelector) === selectedValue,
  )
  const operatorOptions = getComparisonOptionsByVariableType(condition.variableType)
  const requiresValue = comparisonOperatorRequiresValue(condition.comparisonOperator)

  return (
    <PanelCard className="space-y-2 p-2.5">
      <div className="flex items-center gap-2">
        <PanelToken>{condition.variableType}</PanelToken>
        <button
          type="button"
          onClick={() => onRemove(caseId, condition.id)}
          className="ml-auto rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
        >
          删除条件
        </button>
      </div>

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
            placeholder={selectedVariable ? `输入 ${selectedVariable.label} 的比较值` : '输入比较值'}
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
        <div className="rounded-[10px] border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          当前操作符不需要比较值。
        </div>
      )}
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
    <div className="space-y-4">
      <PanelSection title="分支规则">
        <PanelAlert type="info">
          IF / ELIF 分支按顺序命中，未命中时自动进入 ELSE。分支 ID 会同步用于节点出口和 edge.sourceHandle。
        </PanelAlert>
        {issues.length ? (
          <PanelAlert type="warning">
            {issues[0].message}
          </PanelAlert>
        ) : null}
      </PanelSection>

      <PanelSection
        title="条件分支"
        aside={(
          <button
            type="button"
            onClick={handleAddCase}
            className="rounded-lg border border-blue-200 px-2.5 py-1 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            添加 ELIF
          </button>
        )}
      >
        {config.cases.map((caseItem, index) => (
          <PanelCard key={caseItem.case_id} className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <PanelToken>{getIfElseCaseLabel(index)}</PanelToken>
              <span className="text-[11px] text-slate-400">handle: {caseItem.case_id}</span>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => handleMoveCase(caseItem.case_id, 'up')}
                className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                上移
              </button>
              <button
                type="button"
                disabled={index === config.cases.length - 1}
                onClick={() => handleMoveCase(caseItem.case_id, 'down')}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                下移
              </button>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => {
                  handleRemoveCase(caseItem.case_id)
                  setEdges((edges) => edges.filter(
                    edge => !(edge.source === id && edge.sourceHandle === caseItem.case_id),
                  ))
                }}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                删除分支
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-medium text-slate-700">条件组合</span>
                <PanelChoiceGroup
                  className="w-[170px]"
                  size="sm"
                  value={caseItem.logical_operator}
                  options={[
                    { label: '全部满足 AND', value: 'and' },
                    { label: '任一满足 OR', value: 'or' },
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
                <div className="rounded-[12px] border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-500">
                  该分支还没有条件。添加条件后，命中时将从对应 handle 输出。
                </div>
              )}

              <button
                type="button"
                onClick={() => handleAddCondition(caseItem.case_id)}
                className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[12px] font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
              >
                添加条件
              </button>
            </div>
          </PanelCard>
        ))}
      </PanelSection>

      <PanelSection title="兜底分支">
        <PanelCard className="space-y-2 p-3">
          <div className="flex items-center gap-2">
            <PanelToken>ELSE</PanelToken>
            <span className="text-[11px] text-slate-400">handle: false</span>
          </div>
          <p className="text-[12px] leading-5 text-slate-600">
            当前所有 IF / ELIF 条件都未命中时，流程会走到 ELSE 分支。该分支固定存在，不在 cases 内持久化。
          </p>
        </PanelCard>
      </PanelSection>
    </div>
  )
}

export default React.memo(IfElsePanel)