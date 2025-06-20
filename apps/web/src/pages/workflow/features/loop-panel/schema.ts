import type { VariableOption } from '../llm-panel/types'
import {
  buildIfElseConditionSummary,
  comparisonOperatorRequiresValue,
  createEmptyIfElseCondition,
  getComparisonOperatorLabel,
  getComparisonOptionsByVariableType,
  resolveIfElseVariableLabel,
} from '../ifelse-panel/schema'
import { buildContainerChildren, buildContainerStartNodeId } from '../container-panel/runtime'
import type { IfElseLogicalOperator, IfElseVariableType } from '../ifelse-panel/types'
import type {
  LoopBreakCondition,
  LoopNodeConfig,
  LoopValidationIssue,
  LoopVariable,
  LoopVariableType,
  LoopVariableValueType,
} from './types'

export const LOOP_NODE_MAX_COUNT = 100

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value))
    return []

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

const createRandomId = (prefix: string) => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const normalizeLogicalOperator = (value: unknown): IfElseLogicalOperator => {
  return value === 'or' ? 'or' : 'and'
}

const normalizeLoopVariableType = (value: unknown): LoopVariableType => {
  return ['string', 'number', 'boolean', 'array', 'object'].includes(String(value))
    ? value as LoopVariableType
    : 'string'
}

const normalizeLoopValueType = (value: unknown): LoopVariableValueType => {
  return value === 'variable' ? 'variable' : 'constant'
}

const normalizeLoopVariableValue = (value: unknown, variableType: LoopVariableType) => {
  if (variableType === 'number') {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  if (variableType === 'boolean') {
    if (typeof value === 'boolean')
      return value

    return value === 'true'
  }

  return typeof value === 'string' ? value : ''
}

const normalizeLoopCount = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(parsed))
    return 10

  return Math.min(Math.max(Math.round(parsed), 1), LOOP_NODE_MAX_COUNT)
}

const normalizeLoopBreakCondition = (value: unknown): LoopBreakCondition => {
  const normalized = createEmptyIfElseCondition()
  const record = isRecord(value) ? value : {}
  const base = createEmptyIfElseCondition({
    label: 'placeholder',
    valueSelector: sanitizeStringArray(record.variableSelector),
    valueType: ['string', 'number', 'boolean', 'array', 'file', 'object'].includes(String(record.variableType))
      ? record.variableType as IfElseVariableType
      : 'string',
    source: 'node',
  })

  const nextComparisonOperator = typeof record.comparisonOperator === 'string'
    ? record.comparisonOperator as LoopBreakCondition['comparisonOperator']
    : base.comparisonOperator

  return {
    id: typeof record.id === 'string' && record.id ? record.id : normalized.id,
    variableSelector: sanitizeStringArray(record.variableSelector),
    variableType: base.variableType,
    comparisonOperator: nextComparisonOperator,
    value: comparisonOperatorRequiresValue(nextComparisonOperator)
      ? normalizeLoopVariableValue(record.value, base.variableType === 'file' ? 'string' : base.variableType)
      : null,
  }
}

const normalizeLoopVariable = (value: unknown): LoopVariable => {
  const record = isRecord(value) ? value : {}
  const varType = normalizeLoopVariableType(record.var_type)
  const valueType = normalizeLoopValueType(record.value_type)

  return {
    id: typeof record.id === 'string' && record.id ? record.id : createRandomId('loop-var'),
    label: typeof record.label === 'string' ? record.label : '',
    var_type: varType,
    value_type: valueType,
    value: normalizeLoopVariableValue(record.value, varType),
    value_selector: valueType === 'variable' ? sanitizeStringArray(record.value_selector) : [],
  }
}

export const createEmptyLoopVariable = (): LoopVariable => {
  return {
    id: createRandomId('loop-var'),
    label: '',
    var_type: 'string',
    value_type: 'constant',
    value: '',
    value_selector: [],
  }
}

export const createEmptyLoopBreakCondition = (variable?: VariableOption): LoopBreakCondition => {
  return createEmptyIfElseCondition(variable)
}

export const createDefaultLoopNodeConfig = (nodeId?: string): LoopNodeConfig => {
  return {
    start_node_id: buildContainerStartNodeId(nodeId, 'loop'),
    loop_variables: [],
    break_conditions: [],
    logical_operator: 'and',
    loop_count: 10,
    isInIteration: false,
    isInLoop: false,
  }
}

export const normalizeLoopNodeConfig = (value: unknown, nodeId?: string): LoopNodeConfig => {
  const record = isRecord(value) ? value : {}
  const defaults = createDefaultLoopNodeConfig(nodeId)

  return {
    start_node_id: typeof record.start_node_id === 'string' && record.start_node_id.trim()
      ? record.start_node_id
      : defaults.start_node_id,
    loop_variables: Array.isArray(record.loop_variables)
      ? record.loop_variables.map(normalizeLoopVariable)
      : [],
    break_conditions: Array.isArray(record.break_conditions)
      ? record.break_conditions.map(normalizeLoopBreakCondition)
      : [],
    logical_operator: normalizeLogicalOperator(record.logical_operator),
    loop_count: normalizeLoopCount(record.loop_count),
    isInIteration: Boolean(record.isInIteration),
    isInLoop: Boolean(record.isInLoop),
  }
}

export const buildLoopChildren = (startNodeId: string) => {
  return buildContainerChildren('loop', startNodeId)
}

export const getLoopValueTypeLabel = (valueType: LoopVariableValueType) => {
  return valueType === 'variable' ? '引用变量' : '常量'
}

export const getLoopVariableTypeLabel = (valueType: LoopVariableType) => {
  const labels: Record<LoopVariableType, string> = {
    string: 'String',
    number: 'Number',
    boolean: 'Boolean',
    array: 'Array',
    object: 'Object',
  }

  return labels[valueType]
}

export const getLoopLogicalOperatorLabel = (operator: IfElseLogicalOperator) => {
  return operator === 'or' ? '任一满足即停止' : '全部满足后停止'
}

export const buildLoopBreakSummary = (
  condition: LoopBreakCondition,
  variableOptions: VariableOption[],
) => {
  return buildIfElseConditionSummary(condition, variableOptions)
}

export {
  comparisonOperatorRequiresValue,
  getComparisonOperatorLabel,
  getComparisonOptionsByVariableType,
  resolveIfElseVariableLabel,
}

export const validateLoopNodeConfig = (config: LoopNodeConfig): LoopValidationIssue[] => {
  const issues: LoopValidationIssue[] = []

  if (!config.start_node_id.trim()) {
    issues.push({
      path: 'start_node_id',
      message: 'Loop 容器缺少内部 start_node_id。',
    })
  }

  const seenLabels = new Set<string>()
  config.loop_variables.forEach((loopVariable, index) => {
    const normalizedLabel = loopVariable.label.trim()
    const basePath = `loop_variables.${index}`

    if (!normalizedLabel) {
      issues.push({
        path: `${basePath}.label`,
        message: `第 ${index + 1} 个循环变量缺少名称。`,
      })
    } else if (seenLabels.has(normalizedLabel)) {
      issues.push({
        path: `${basePath}.label`,
        message: `循环变量 ${normalizedLabel} 重复，请改成唯一名称。`,
      })
    }

    seenLabels.add(normalizedLabel)

    if (loopVariable.value_type === 'variable' && !loopVariable.value_selector.length) {
      issues.push({
        path: `${basePath}.value_selector`,
        message: `循环变量 ${normalizedLabel || index + 1} 需要引用一个变量值。`,
      })
    }
  })

  config.break_conditions.forEach((condition, index) => {
    const basePath = `break_conditions.${index}`

    if (!condition.variableSelector.length) {
      issues.push({
        path: `${basePath}.variableSelector`,
        message: 'Break condition 缺少变量。',
      })
    }

    if (comparisonOperatorRequiresValue(condition.comparisonOperator) && (condition.value === '' || condition.value === null)) {
      issues.push({
        path: `${basePath}.value`,
        message: 'Break condition 缺少比较值。',
      })
    }
  })

  if (config.loop_count < 1 || config.loop_count > LOOP_NODE_MAX_COUNT) {
    issues.push({
      path: 'loop_count',
      message: `循环次数必须在 1 到 ${LOOP_NODE_MAX_COUNT} 之间。`,
    })
  }

  return issues
}