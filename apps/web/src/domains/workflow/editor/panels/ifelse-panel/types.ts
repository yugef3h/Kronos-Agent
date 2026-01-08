import type {
  ValidationIssue,
  ValueSelector,
  VariableOption,
} from '../llm-panel/types'

export type IfElseLogicalOperator = 'and' | 'or'

export type IfElseVariableType = VariableOption['valueType'] | 'boolean'

export type IfElseComparisonOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'

export type IfElseConditionValue = string | number | boolean | null

export type IfElseCondition = {
  id: string
  variableSelector: ValueSelector
  variableType: IfElseVariableType
  comparisonOperator: IfElseComparisonOperator
  value: IfElseConditionValue
}

export type IfElseCaseItem = {
  case_id: string
  logical_operator: IfElseLogicalOperator
  conditions: IfElseCondition[]
}

export type IfElseNodeConfig = {
  cases: IfElseCaseItem[]
  isInIteration: boolean
  isInLoop: boolean
}

export type IfElseBranch = {
  id: string
  name: string
}

export type IfElseValidationIssue = ValidationIssue
