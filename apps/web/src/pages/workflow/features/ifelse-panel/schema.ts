import type { VariableOption } from '../llm-panel/types'
import type {
  IfElseBranch,
  IfElseCaseItem,
  IfElseComparisonOperator,
  IfElseCondition,
  IfElseConditionValue,
  IfElseLogicalOperator,
  IfElseNodeConfig,
  IfElseVariableType,
  IfElseValidationIssue,
} from './types'

export const DEFAULT_IF_CASE_ID = 'true'
export const ELSE_BRANCH_ID = 'false'

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

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value))
    return []

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const createRandomId = (prefix: string) => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const normalizeLogicalOperator = (value: unknown): IfElseLogicalOperator => {
  return value === 'or' ? 'or' : 'and'
}

export const getDefaultComparisonOperator = (
  variableType: IfElseVariableType,
): IfElseComparisonOperator => {
  if (variableType === 'boolean')
    return 'is'

  if (variableType === 'file' || variableType === 'array' || variableType === 'object')
    return 'is_not_empty'

  return 'is'
}

export const comparisonOperatorRequiresValue = (operator: IfElseComparisonOperator) => {
  return !['is_empty', 'is_not_empty'].includes(operator)
}

const normalizeVariableType = (value: unknown): IfElseVariableType => {
  return IF_ELSE_VARIABLE_TYPES.includes(value as IfElseVariableType)
    ? value as IfElseVariableType
    : 'string'
}

const normalizeComparisonOperator = (
  value: unknown,
  variableType: IfElseVariableType,
): IfElseComparisonOperator => {
  return IF_ELSE_COMPARISON_OPERATORS.includes(value as IfElseComparisonOperator)
    ? value as IfElseComparisonOperator
    : getDefaultComparisonOperator(variableType)
}

const normalizeConditionValue = (
  value: unknown,
  variableType: IfElseVariableType,
  comparisonOperator: IfElseComparisonOperator,
): IfElseConditionValue => {
  if (!comparisonOperatorRequiresValue(comparisonOperator))
    return null

  if (variableType === 'boolean') {
    if (typeof value === 'boolean')
      return value

    if (value === 'true')
      return true

    if (value === 'false')
      return false

    return true
  }

  if (variableType === 'number') {
    if (typeof value === 'number' && !Number.isNaN(value))
      return value

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value)
      return Number.isNaN(parsed) ? 0 : parsed
    }

    return 0
  }

  return typeof value === 'string' ? value : ''
}

export const createEmptyIfElseCondition = (variable?: VariableOption): IfElseCondition => {
  const variableType = variable?.valueType ?? 'string'
  const comparisonOperator = getDefaultComparisonOperator(variableType)

  return {
    id: createRandomId('condition'),
    variableSelector: variable?.valueSelector ?? [],
    variableType,
    comparisonOperator,
    value: normalizeConditionValue(null, variableType, comparisonOperator),
  }
}

export const createDefaultIfElseNodeConfig = (): IfElseNodeConfig => {
  return {
    cases: [{
      case_id: DEFAULT_IF_CASE_ID,
      logical_operator: 'and',
      conditions: [],
    }],
    isInIteration: false,
    isInLoop: false,
  }
}

const normalizeCondition = (value: unknown): IfElseCondition => {
  const record = isRecord(value) ? value : {}
  const legacyVariableSelector = sanitizeStringArray(record.variable_selector)
  const variableSelector = sanitizeStringArray(record.variableSelector)
  const variableType = normalizeVariableType(record.variableType ?? record.varType)
  const comparisonOperator = normalizeComparisonOperator(
    record.comparisonOperator ?? record.comparison_operator,
    variableType,
  )

  return {
    id: typeof record.id === 'string' && record.id
      ? record.id
      : createRandomId('condition'),
    variableSelector: variableSelector.length ? variableSelector : legacyVariableSelector,
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
        : createRandomId('case'),
    logical_operator: normalizeLogicalOperator(record.logical_operator),
    conditions: Array.isArray(record.conditions)
      ? record.conditions.map(normalizeCondition)
      : [],
  }
}

const dedupeCases = (cases: IfElseCaseItem[]): IfElseCaseItem[] => {
  const usedCaseIds = new Set<string>()

  return cases.map((caseItem, index) => {
    const preferredCaseId = index === 0 ? DEFAULT_IF_CASE_ID : caseItem.case_id
    const nextCaseId = !usedCaseIds.has(preferredCaseId)
      ? preferredCaseId
      : createRandomId('case')

    usedCaseIds.add(nextCaseId)

    return {
      ...caseItem,
      case_id: nextCaseId,
    }
  })
}

export const normalizeIfElseNodeConfig = (value: unknown): IfElseNodeConfig => {
  const record = isRecord(value) ? value : {}
  const legacyConditions = Array.isArray(record.conditions) ? record.conditions : null
  const normalizedCases = Array.isArray(record.cases)
    ? record.cases.map(normalizeCase)
    : legacyConditions
      ? [{
          case_id: DEFAULT_IF_CASE_ID,
          logical_operator: normalizeLogicalOperator(record.logical_operator),
          conditions: legacyConditions.map(normalizeCondition),
        }]
      : []

  const cases = dedupeCases(normalizedCases.length ? normalizedCases : createDefaultIfElseNodeConfig().cases)

  return {
    cases,
    isInIteration: Boolean(record.isInIteration),
    isInLoop: Boolean(record.isInLoop),
  }
}

export const getIfElseCaseLabel = (index: number) => {
  return index === 0 ? 'IF' : `ELIF ${index}`
}

export const buildIfElseTargetBranches = (cases: IfElseCaseItem[]): IfElseBranch[] => {
  return [
    ...cases.map((caseItem, index) => ({
      id: caseItem.case_id,
      name: getIfElseCaseLabel(index),
    })),
    {
      id: ELSE_BRANCH_ID,
      name: 'ELSE',
    },
  ]
}

export const getComparisonOptionsByVariableType = (variableType: IfElseVariableType) => {
  const commonOptions: Array<{ label: string; value: IfElseComparisonOperator }> = [
    { label: '为空', value: 'is_empty' },
    { label: '不为空', value: 'is_not_empty' },
  ]

  if (variableType === 'boolean') {
    return [{ label: '等于', value: 'is' }]
  }

  if (variableType === 'number') {
    return [
      { label: '等于', value: 'is' },
      { label: '不等于', value: 'is_not' },
      { label: '大于', value: 'greater_than' },
      { label: '大于等于', value: 'greater_than_or_equal' },
      { label: '小于', value: 'less_than' },
      { label: '小于等于', value: 'less_than_or_equal' },
      ...commonOptions,
    ]
  }

  if (variableType === 'file' || variableType === 'array' || variableType === 'object') {
    return [
      { label: '包含', value: 'contains' },
      { label: '不包含', value: 'not_contains' },
      ...commonOptions,
    ]
  }

  return [
    { label: '等于', value: 'is' },
    { label: '不等于', value: 'is_not' },
    { label: '包含', value: 'contains' },
    { label: '不包含', value: 'not_contains' },
    { label: '开头是', value: 'starts_with' },
    { label: '结尾是', value: 'ends_with' },
    ...commonOptions,
  ]
}

export const validateIfElseNodeConfig = (config: IfElseNodeConfig): IfElseValidationIssue[] => {
  const issues: IfElseValidationIssue[] = []

  if (!config.cases.length) {
    issues.push({
      path: 'cases',
      message: '至少需要一个 IF 分支。',
    })
    return issues
  }

  config.cases.forEach((caseItem, caseIndex) => {
    caseItem.conditions.forEach((condition, conditionIndex) => {
      const fieldPath = `cases.${caseIndex}.conditions.${conditionIndex}`

      if (!condition.variableSelector.length) {
        issues.push({
          path: `${fieldPath}.variableSelector`,
          message: `${getIfElseCaseLabel(caseIndex)} 分支有未选择变量的条件。`,
        })
      }

      if (
        comparisonOperatorRequiresValue(condition.comparisonOperator)
        && (
          condition.value === null
          || condition.value === ''
          || Number.isNaN(condition.value)
        )
      ) {
        issues.push({
          path: `${fieldPath}.value`,
          message: `${getIfElseCaseLabel(caseIndex)} 分支有未填写比较值的条件。`,
        })
      }
    })
  })

  return issues
}
