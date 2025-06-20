import { useMemo } from 'react'
import { produce } from 'immer'
import type { VariableOption } from '../llm-panel/types'
import type { IfElseLogicalOperator } from '../ifelse-panel/types'
import {
  createEmptyLoopBreakCondition,
  createEmptyLoopVariable,
  normalizeLoopNodeConfig,
  validateLoopNodeConfig,
} from './schema'
import type { LoopBreakCondition, LoopNodeConfig, LoopVariable } from './types'

type UseLoopPanelConfigOptions = {
  nodeId: string
  value: unknown
  onChange: (nextValue: LoopNodeConfig) => void
}

export const useLoopPanelConfig = ({
  nodeId,
  value,
  onChange,
}: UseLoopPanelConfigOptions) => {
  const config = useMemo(() => normalizeLoopNodeConfig(value, nodeId), [nodeId, value])
  const issues = useMemo(() => validateLoopNodeConfig(config), [config])

  const update = (recipe: (draft: LoopNodeConfig) => void) => {
    const nextValue = produce(config, recipe)
    onChange(nextValue)
  }

  const handleAddLoopVariable = () => {
    update((draft) => {
      draft.loop_variables.push(createEmptyLoopVariable())
    })
  }

  const handleRemoveLoopVariable = (variableId: string) => {
    update((draft) => {
      const target = draft.loop_variables.find(variable => variable.id === variableId)
      draft.loop_variables = draft.loop_variables.filter(variable => variable.id !== variableId)

      if (target?.label.trim()) {
        draft.break_conditions = draft.break_conditions.filter(
          condition => condition.variableSelector.join('.') !== `${nodeId}.${target.label.trim()}`,
        )
      }
    })
  }

  const handleUpdateLoopVariable = (variableId: string, patch: Partial<LoopVariable>) => {
    update((draft) => {
      const target = draft.loop_variables.find(variable => variable.id === variableId)
      if (!target)
        return

      const previousLabel = target.label.trim()
      Object.assign(target, patch)

      if (patch.var_type === 'boolean' && patch.value_type !== 'variable') {
        target.value = Boolean(target.value)
      }

      if (patch.value_type === 'constant') {
        target.value_selector = []
      }

      if (patch.value_type === 'variable') {
        target.value = ''
      }

      const nextLabel = target.label.trim()
      if (patch.label !== undefined && previousLabel && nextLabel && previousLabel !== nextLabel) {
        draft.break_conditions = draft.break_conditions.map((condition) => {
          if (condition.variableSelector.join('.') !== `${nodeId}.${previousLabel}`)
            return condition

          return {
            ...condition,
            variableSelector: [nodeId, nextLabel],
            variableType: target.var_type,
          }
        })
      }
    })
  }

  const handleLogicalOperatorChange = (value: IfElseLogicalOperator) => {
    update((draft) => {
      draft.logical_operator = value
    })
  }

  const handleLoopCountChange = (value: number | null) => {
    update((draft) => {
      draft.loop_count = value === null ? 1 : Math.round(value)
    })
  }

  const handleAddBreakCondition = (variable?: VariableOption) => {
    update((draft) => {
      draft.break_conditions.push(createEmptyLoopBreakCondition(variable))
    })
  }

  const handleRemoveBreakCondition = (conditionId: string) => {
    update((draft) => {
      draft.break_conditions = draft.break_conditions.filter(condition => condition.id !== conditionId)
    })
  }

  const handleConditionVariableChange = (conditionId: string, variable?: VariableOption) => {
    update((draft) => {
      const target = draft.break_conditions.find(condition => condition.id === conditionId)
      if (!target)
        return

      const nextCondition = createEmptyLoopBreakCondition(variable)
      target.variableSelector = nextCondition.variableSelector
      target.variableType = nextCondition.variableType
      target.comparisonOperator = nextCondition.comparisonOperator
      target.value = nextCondition.value
    })
  }

  const handleConditionOperatorChange = (conditionId: string, value: LoopBreakCondition['comparisonOperator']) => {
    update((draft) => {
      const target = draft.break_conditions.find(condition => condition.id === conditionId)
      if (!target)
        return

      target.comparisonOperator = value
      if (target.value === null && value !== 'is_empty' && value !== 'is_not_empty') {
        target.value = target.variableType === 'boolean' ? true : ''
      }

      if (value === 'is_empty' || value === 'is_not_empty') {
        target.value = null
      }
    })
  }

  const handleConditionValueChange = (conditionId: string, value: LoopBreakCondition['value']) => {
    update((draft) => {
      const target = draft.break_conditions.find(condition => condition.id === conditionId)
      if (!target)
        return

      target.value = value
    })
  }

  return {
    config,
    issues,
    handleAddLoopVariable,
    handleRemoveLoopVariable,
    handleUpdateLoopVariable,
    handleLogicalOperatorChange,
    handleLoopCountChange,
    handleAddBreakCondition,
    handleRemoveBreakCondition,
    handleConditionVariableChange,
    handleConditionOperatorChange,
    handleConditionValueChange,
  }
}