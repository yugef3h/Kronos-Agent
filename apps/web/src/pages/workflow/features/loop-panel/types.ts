import type { ValueSelector } from '../llm-panel/types'
import type {
  IfElseComparisonOperator,
  IfElseConditionValue,
  IfElseLogicalOperator,
  IfElseVariableType,
} from '../ifelse-panel/types'

export type LoopVariableType = Exclude<IfElseVariableType, 'file'>
export type LoopVariableValueType = 'constant' | 'variable'

export type LoopVariable = {
  id: string
  label: string
  var_type: LoopVariableType
  value_type: LoopVariableValueType
  value: string | number | boolean
  value_selector: ValueSelector
}

export type LoopBreakCondition = {
  id: string
  variableSelector: ValueSelector
  variableType: IfElseVariableType
  comparisonOperator: IfElseComparisonOperator
  value: IfElseConditionValue
}

export type LoopNodeConfig = {
  start_node_id: string
  loop_variables: LoopVariable[]
  break_conditions: LoopBreakCondition[]
  logical_operator: IfElseLogicalOperator
  loop_count: number
  isInIteration: boolean
  isInLoop: boolean
}

export type LoopValidationIssue = {
  path: string
  message: string
}