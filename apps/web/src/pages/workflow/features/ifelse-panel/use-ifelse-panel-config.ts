import { useMemo } from 'react'
import { produce } from 'immer'
import type { VariableOption } from '../llm-panel/types'
import {
  comparisonOperatorRequiresValue,
  createEmptyIfElseCondition,
  normalizeIfElseNodeConfig,
  validateIfElseNodeConfig,
  getDefaultComparisonOperator,
} from './schema'
import type {
  IfElseComparisonOperator,
  IfElseConditionValue,
  IfElseLogicalOperator,
  IfElseNodeConfig,
} from './types'

type UseIfElsePanelConfigOptions = {
  value: unknown
  onChange: (nextValue: IfElseNodeConfig) => void
}

const createCaseId = () => `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const useIfElsePanelConfig = ({ value, onChange }: UseIfElsePanelConfigOptions) => {
  const config = useMemo(() => normalizeIfElseNodeConfig(value), [value])
  const issues = useMemo(() => validateIfElseNodeConfig(config), [config])

  const update = (recipe: (draft: IfElseNodeConfig) => void) => {
    const nextValue = produce(config, recipe)
    onChange(nextValue)
  }

  const handleAddCase = () => {
    update((draft) => {
      draft.cases.push({
        case_id: createCaseId(),
        logical_operator: 'and',
        conditions: [],
      })
    })
  }

  const handleRemoveCase = (caseId: string) => {
    update((draft) => {
      if (draft.cases.length <= 1)
        return

      draft.cases = draft.cases.filter(caseItem => caseItem.case_id !== caseId)
    })
  }

  const handleMoveCase = (caseId: string, direction: 'up' | 'down') => {
    update((draft) => {
      const currentIndex = draft.cases.findIndex(caseItem => caseItem.case_id === caseId)
      if (currentIndex === -1)
        return

      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (nextIndex < 0 || nextIndex >= draft.cases.length)
        return

      const [removed] = draft.cases.splice(currentIndex, 1)
      draft.cases.splice(nextIndex, 0, removed)
    })
  }

  const handleCaseLogicalOperatorChange = (caseId: string, logicalOperator: IfElseLogicalOperator) => {
    update((draft) => {
      const caseItem = draft.cases.find(item => item.case_id === caseId)
      if (!caseItem)
        return

      caseItem.logical_operator = logicalOperator
    })
  }

  const handleAddCondition = (caseId: string, variable?: VariableOption) => {
    const nextCondition = createEmptyIfElseCondition(variable)

    update((draft) => {
      const caseItem = draft.cases.find(item => item.case_id === caseId)
      if (!caseItem)
        return

      caseItem.conditions.push(nextCondition)
    })

    return nextCondition.id
  }

  const handleRemoveCondition = (caseId: string, conditionId: string) => {
    update((draft) => {
      const caseItem = draft.cases.find(item => item.case_id === caseId)
      if (!caseItem)
        return

      caseItem.conditions = caseItem.conditions.filter(condition => condition.id !== conditionId)
    })
  }

  const handleConditionVariableChange = (caseId: string, conditionId: string, variable?: VariableOption) => {
    update((draft) => {
      const caseItem = draft.cases.find(item => item.case_id === caseId)
      const condition = caseItem?.conditions.find(item => item.id === conditionId)
      if (!condition || !variable)
        return

      condition.variableSelector = variable.valueSelector
      condition.variableType = variable.valueType
      condition.comparisonOperator = getDefaultComparisonOperator(variable.valueType)
      condition.value = createEmptyIfElseCondition(variable).value
    })
  }

  const handleConditionOperatorChange = (
    caseId: string,
    conditionId: string,
    operator: IfElseComparisonOperator,
  ) => {
    update((draft) => {
      const caseItem = draft.cases.find(item => item.case_id === caseId)
      const condition = caseItem?.conditions.find(item => item.id === conditionId)
      if (!condition)
        return

      condition.comparisonOperator = operator
      if (!comparisonOperatorRequiresValue(operator)) {
        condition.value = null
        return
      }

      if (condition.variableType === 'boolean') {
        condition.value = typeof condition.value === 'boolean' ? condition.value : true
        return
      }

      if (condition.variableType === 'number') {
        condition.value = typeof condition.value === 'number' ? condition.value : 0
        return
      }

      condition.value = typeof condition.value === 'string' ? condition.value : ''
    })
  }

  const handleConditionValueChange = (
    caseId: string,
    conditionId: string,
    value: IfElseConditionValue,
  ) => {
    update((draft) => {
      const caseItem = draft.cases.find(item => item.case_id === caseId)
      const condition = caseItem?.conditions.find(item => item.id === conditionId)
      if (!condition)
        return

      condition.value = value
    })
  }

  return {
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
  }
}
