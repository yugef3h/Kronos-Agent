import type { VariableOption } from '../llm-panel/types'
import type { CanvasNodeData } from '../../types/canvas'
import type { EndNodeConfig, EndOutputDefinition, EndValidationIssue } from './types'

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

export const createEmptyEndOutput = (): EndOutputDefinition => {
  return {
    id: createRandomId('end-output'),
    variable: '',
    value_selector: [],
    variable_type: 'variable',
    value: '',
  }
}

export const createDefaultEndNodeConfig = (existingOutputs?: CanvasNodeData['outputs']): EndNodeConfig => {
  const outputKeys = Object.keys(existingOutputs ?? {})

  if (!outputKeys.length) {
    return {
      outputs: [{
        ...createEmptyEndOutput(),
        variable: 'result',
        variable_type: 'constant',
      }],
    }
  }

  return {
    outputs: outputKeys.map((key) => ({
      ...createEmptyEndOutput(),
      variable: key,
      variable_type: 'constant',
    })),
  }
}

const normalizeEndOutput = (value: unknown): EndOutputDefinition => {
  const record = isRecord(value) ? value : {}

  return {
    id: typeof record.id === 'string' && record.id ? record.id : createRandomId('end-output'),
    variable: typeof record.variable === 'string' ? record.variable : '',
    value_selector: sanitizeStringArray(record.value_selector),
    variable_type: record.variable_type === 'constant' ? 'constant' : 'variable',
    value: typeof record.value === 'string' ? record.value : '',
  }
}

export const normalizeEndNodeConfig = (value: unknown, existingOutputs?: CanvasNodeData['outputs']): EndNodeConfig => {
  const record = isRecord(value) ? value : {}

  if (!Array.isArray(record.outputs))
    return createDefaultEndNodeConfig(existingOutputs)

  return {
    outputs: record.outputs.map(normalizeEndOutput),
  }
}

export const buildEndNodeOutputs = (config: EndNodeConfig): CanvasNodeData['outputs'] => {
  return config.outputs.reduce<Record<string, unknown>>((acc, output) => {
    const key = output.variable.trim()
    if (!key)
      return acc

    acc[key] = output.variable_type === 'constant' ? output.value : ''
    return acc
  }, {})
}

export const buildEndOutputTypes = (config: EndNodeConfig, variableOptions: VariableOption[]) => {
  return config.outputs.reduce<Record<string, string>>((acc, output) => {
    const key = output.variable.trim()
    if (!key)
      return acc

    if (output.variable_type === 'constant') {
      acc[key] = 'string'
      return acc
    }

    const option = variableOptions.find(candidate => candidate.valueSelector.join('.') === output.value_selector.join('.'))
    acc[key] = option?.valueType ?? 'string'
    return acc
  }, {})
}

export const validateEndNodeConfig = (config: EndNodeConfig): EndValidationIssue[] => {
  const issues: EndValidationIssue[] = []
  const seenVariables = new Set<string>()

  config.outputs.forEach((output, index) => {
    const basePath = `outputs.${index}`
    const normalizedVariable = output.variable.trim()

    if (!normalizedVariable) {
      issues.push({
        path: `${basePath}.variable`,
        message: `第 ${index + 1} 个输出项缺少变量名。`,
      })
    } else if (seenVariables.has(normalizedVariable)) {
      issues.push({
        path: `${basePath}.variable`,
        message: `输出变量 ${normalizedVariable} 重复，请改成唯一名称。`,
      })
    }

    if (output.variable_type === 'variable' && !output.value_selector.length) {
      issues.push({
        path: `${basePath}.value_selector`,
        message: `输出变量 ${normalizedVariable || index + 1} 还没有绑定值来源。`,
      })
    }

    seenVariables.add(normalizedVariable)
  })

  return issues
}