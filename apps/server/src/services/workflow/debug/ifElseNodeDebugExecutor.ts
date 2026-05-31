import {
  NodeRunStatus,
  type NodeDebugExecutor,
  type NodeDebugRequest,
  type NodeDebugResult,
  type RunError,
} from '../types/types.js'

export const DEFAULT_IF_CASE_ID = 'true'
export const ELSE_BRANCH_ID = 'false'

type IfElseLogicalOperator = 'and' | 'or'
type IfElseVariableType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file'
type IfElseComparisonOperator =
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

type IfElseConditionValue = string | number | boolean | null

type IfElseCondition = {
  id: string
  variableSelector: string[]
  variableType: IfElseVariableType
  comparisonOperator: IfElseComparisonOperator
  value: IfElseConditionValue
}

type IfElseCaseItem = {
  case_id: string
  logical_operator: IfElseLogicalOperator
  conditions: IfElseCondition[]
}

type IfElseNodeConfig = {
  cases: IfElseCaseItem[]
}

type IfElseValidationIssue = {
  path: string
  message: string
}

const IF_ELSE_VARIABLE_TYPES: IfElseVariableType[] = ['string', 'number', 'boolean', 'array', 'file', 'object']
const IF_ELSE_COMPARISON_OPERATORS: IfElseComparisonOperator[] = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
  'is_empty',
  'is_not_empty',
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

const comparisonOperatorRequiresValue = (operator: IfElseComparisonOperator) =>
  !['is_empty', 'is_not_empty'].includes(operator)

const getDefaultComparisonOperator = (variableType: IfElseVariableType): IfElseComparisonOperator => {
  if (variableType === 'boolean') {
    return 'is'
  }

  if (variableType === 'file' || variableType === 'array' || variableType === 'object') {
    return 'is_not_empty'
  }

  return 'is'
}

const normalizeVariableType = (value: unknown): IfElseVariableType =>
  IF_ELSE_VARIABLE_TYPES.includes(value as IfElseVariableType) ? value as IfElseVariableType : 'string'

const normalizeComparisonOperator = (
  value: unknown,
  variableType: IfElseVariableType,
): IfElseComparisonOperator =>
  IF_ELSE_COMPARISON_OPERATORS.includes(value as IfElseComparisonOperator)
    ? value as IfElseComparisonOperator
    : getDefaultComparisonOperator(variableType)

const normalizeConditionValue = (
  value: unknown,
  variableType: IfElseVariableType,
  comparisonOperator: IfElseComparisonOperator,
): IfElseConditionValue => {
  if (!comparisonOperatorRequiresValue(comparisonOperator)) {
    return null
  }

  if (variableType === 'boolean') {
    if (typeof value === 'boolean') {
      return value
    }

    return value === 'true'
  }

  if (variableType === 'number') {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value
    }

    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return typeof value === 'string' ? value : ''
}

const normalizeCondition = (value: unknown): IfElseCondition => {
  const record = isRecord(value) ? value : {}
  const variableType = normalizeVariableType(record.variableType ?? record.varType)
  const comparisonOperator = normalizeComparisonOperator(
    record.comparisonOperator ?? record.comparison_operator,
    variableType,
  )

  return {
    id: typeof record.id === 'string' && record.id ? record.id : `condition-${Date.now()}`,
    variableSelector: sanitizeStringArray(record.variableSelector ?? record.variable_selector),
    variableType,
    comparisonOperator,
    value: normalizeConditionValue(record.value, variableType, comparisonOperator),
  }
}

const normalizeCase = (value: unknown, index: number): IfElseCaseItem => {
  const record = isRecord(value) ? value : {}

  return {
    case_id: typeof record.case_id === 'string' && record.case_id && record.case_id !== ELSE_BRANCH_ID
      ? record.case_id
      : index === 0
        ? DEFAULT_IF_CASE_ID
        : `case-${Date.now()}`,
    logical_operator: record.logical_operator === 'or' ? 'or' : 'and',
    conditions: Array.isArray(record.conditions) ? record.conditions.map(normalizeCondition) : [],
  }
}

export const normalizeIfElseNodeConfig = (value: unknown): IfElseNodeConfig => {
  const record = isRecord(value) ? value : {}
  const legacyConditions = Array.isArray(record.conditions) ? record.conditions : null
  const normalizedCases = Array.isArray(record.cases)
    ? record.cases.map(normalizeCase)
    : legacyConditions
      ? [{
          case_id: DEFAULT_IF_CASE_ID,
          logical_operator: (record.logical_operator === 'or' ? 'or' : 'and') as IfElseLogicalOperator,
          conditions: legacyConditions.map(normalizeCondition),
        }]
      : []

  return {
    cases: normalizedCases.length
      ? normalizedCases
      : [{ case_id: DEFAULT_IF_CASE_ID, logical_operator: 'and', conditions: [] }],
  }
}

export const validateIfElseNodeConfig = (config: IfElseNodeConfig): IfElseValidationIssue[] => {
  const issues: IfElseValidationIssue[] = []

  if (!config.cases.length) {
    issues.push({ path: 'cases', message: '至少需要一个 IF 分支。' })
    return issues
  }

  config.cases.forEach((caseItem, caseIndex) => {
    caseItem.conditions.forEach((condition, conditionIndex) => {
      const fieldPath = `cases.${caseIndex}.conditions.${conditionIndex}`

      if (!condition.variableSelector.length) {
        issues.push({
          path: `${fieldPath}.variableSelector`,
          message: `分支 ${caseIndex + 1} 有未选择变量的条件。`,
        })
      }

      if (
        comparisonOperatorRequiresValue(condition.comparisonOperator)
        && (condition.value === null || condition.value === '' || Number.isNaN(condition.value))
      ) {
        issues.push({
          path: `${fieldPath}.value`,
          message: `分支 ${caseIndex + 1} 有未填写比较值的条件。`,
        })
      }
    })
  })

  return issues
}

const resolveSelectorValue = (
  selector: string[],
  variables: Record<string, unknown> | undefined,
): unknown => {
  if (!selector.length) {
    return undefined
  }

  if (!variables) {
    return `[mock:${selector.join('.')}]`
  }

  const dottedKey = selector.join('.')
  if (Object.prototype.hasOwnProperty.call(variables, dottedKey)) {
    return variables[dottedKey]
  }

  let current: unknown = variables
  for (const segment of selector) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return `[mock:${dottedKey}]`
    }

    current = current[segment]
  }

  return current
}

const isEmptyValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  if (isRecord(value)) {
    return Object.keys(value).length === 0
  }

  return false
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return value
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const toComparableString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value ?? '')
  } catch {
    return String(value ?? '')
  }
}

export const evaluateIfElseCondition = (
  condition: IfElseCondition,
  variables: Record<string, unknown> | undefined,
): boolean => {
  const leftValue = resolveSelectorValue(condition.variableSelector, variables)
  const rightValue = condition.value

  switch (condition.comparisonOperator) {
    case 'is_empty':
      return isEmptyValue(leftValue)
    case 'is_not_empty':
      return !isEmptyValue(leftValue)
    case 'is':
      if (condition.variableType === 'boolean') {
        return Boolean(leftValue) === Boolean(rightValue)
      }

      if (condition.variableType === 'number') {
        return toNumber(leftValue) === toNumber(rightValue)
      }

      return toComparableString(leftValue) === toComparableString(rightValue)
    case 'is_not':
      return !evaluateIfElseCondition({ ...condition, comparisonOperator: 'is' }, variables)
    case 'contains':
      if (Array.isArray(leftValue)) {
        return leftValue.some((item) => toComparableString(item) === toComparableString(rightValue))
      }

      return toComparableString(leftValue).includes(toComparableString(rightValue))
    case 'not_contains':
      return !evaluateIfElseCondition({ ...condition, comparisonOperator: 'contains' }, variables)
    case 'starts_with':
      return toComparableString(leftValue).startsWith(toComparableString(rightValue))
    case 'ends_with':
      return toComparableString(leftValue).endsWith(toComparableString(rightValue))
    case 'greater_than':
      return toNumber(leftValue) > toNumber(rightValue)
    case 'greater_than_or_equal':
      return toNumber(leftValue) >= toNumber(rightValue)
    case 'less_than':
      return toNumber(leftValue) < toNumber(rightValue)
    case 'less_than_or_equal':
      return toNumber(leftValue) <= toNumber(rightValue)
    default:
      return false
  }
}

export const evaluateIfElseCase = (
  caseItem: IfElseCaseItem,
  variables: Record<string, unknown> | undefined,
): boolean => {
  if (!caseItem.conditions.length) {
    return false
  }

  if (caseItem.logical_operator === 'or') {
    return caseItem.conditions.some((condition) => evaluateIfElseCondition(condition, variables))
  }

  return caseItem.conditions.every((condition) => evaluateIfElseCondition(condition, variables))
}

export const resolveMatchedIfElseBranch = (
  config: IfElseNodeConfig,
  variables: Record<string, unknown> | undefined,
): { branchId: string; caseIndex: number | null } => {
  for (let index = 0; index < config.cases.length; index += 1) {
    const caseItem = config.cases[index]
    if (evaluateIfElseCase(caseItem, variables)) {
      return { branchId: caseItem.case_id, caseIndex: index }
    }
  }

  return { branchId: ELSE_BRANCH_ID, caseIndex: null }
}

const buildFailedResult = (
  request: NodeDebugRequest,
  startedAt: number,
  error: RunError,
): NodeDebugResult => {
  const finishedAt = Date.now()

  return {
    nodeId: request.node.id,
    status: NodeRunStatus.Failed,
    startedAt,
    finishedAt,
    elapsedMs: Math.max(0, finishedAt - startedAt),
    inputs: request.inputs,
    error,
  }
}

export const executeIfElseNodeDebug: NodeDebugExecutor = async (request) => {
  const startedAt = Date.now()
  const config = normalizeIfElseNodeConfig(request.node.inputs ?? request.node.data)
  const configIssues = validateIfElseNodeConfig(config)

  if (configIssues.length > 0) {
    return buildFailedResult(request, startedAt, {
      code: 'ifelse_config_invalid',
      message: configIssues[0]?.message ?? '条件节点配置无效',
      nodeId: request.node.id,
      details: { issues: configIssues },
    })
  }

  const variables = {
    ...(isRecord(request.context?.variables) ? request.context.variables : {}),
    ...(isRecord(request.inputs) ? request.inputs : {}),
  }

  const { branchId, caseIndex } = resolveMatchedIfElseBranch(config, variables)
  const evaluations = config.cases.map((caseItem, index) => ({
    case_id: caseItem.case_id,
    case_index: index,
    matched: evaluateIfElseCase(caseItem, variables),
    conditions: caseItem.conditions.map((condition) => ({
      id: condition.id,
      variable_selector: condition.variableSelector,
      comparison_operator: condition.comparisonOperator,
      expected_value: condition.value,
      actual_value: resolveSelectorValue(condition.variableSelector, variables),
      matched: evaluateIfElseCondition(condition, variables),
    })),
  }))

  const finishedAt = Date.now()

  return {
    nodeId: request.node.id,
    status: NodeRunStatus.Succeeded,
    startedAt,
    finishedAt,
    elapsedMs: Math.max(0, finishedAt - startedAt),
    inputs: { variables },
    outputs: {
      branchId,
      caseIndex,
      isElse: branchId === ELSE_BRANCH_ID,
      evaluations,
    },
  }
}
