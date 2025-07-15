import type { CanvasNodeData } from '../../types/canvas'
import type { StartNodeConfig, StartValidationIssue, StartVariable, StartVariableType } from './types'

const RESERVED_VARIABLE_NAMES = new Set(['query', 'files', 'conversation_id'])

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const createRandomId = (prefix: string) => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const normalizeVariableType = (value: unknown): StartVariableType => {
  const normalized = String(value)

  if (['text-input', 'paragraph', 'select', 'number', 'url', 'json', 'json_object', 'file', 'file-list', 'checkbox'].includes(normalized))
    return normalized as StartVariableType

  return 'text-input'
}

const sanitizeStringArray = (value: unknown) => {
  if (!Array.isArray(value))
    return []

  return value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
}

export const START_SYSTEM_VARIABLES = [
  {
    variable: 'sys.query',
    type: 'String',
    description: '当前用户输入文本，作为工作流入口主查询。',
  },
  {
    variable: 'sys.files',
    type: 'File',
    description: '当前请求随附文件集合，可供识图、检索等节点直接引用。',
  },
  {
    variable: 'sys.conversation_id',
    type: 'String',
    description: '当前会话标识，可用于日志、检索和链路追踪。',
  },
] as const

export const createEmptyStartVariable = (): StartVariable => {
  return {
    id: createRandomId('start-var'),
    variable: '',
    label: '',
    type: 'text-input',
    required: false,
    options: [],
    placeholder: '',
    hint: '',
  }
}

export const createDefaultStartNodeConfig = (): StartNodeConfig => {
  return {
    variables: [],
  }
}

const normalizeStartVariable = (value: unknown): StartVariable => {
  const record = isRecord(value) ? value : {}
  const type = normalizeVariableType(record.type)

  return {
    id: typeof record.id === 'string' && record.id ? record.id : createRandomId('start-var'),
    variable: typeof record.variable === 'string' ? record.variable : '',
    label: typeof record.label === 'string' ? record.label : '',
    type,
    required: Boolean(record.required),
    options: type === 'select' ? sanitizeStringArray(record.options) : [],
    placeholder: typeof record.placeholder === 'string' ? record.placeholder : '',
    hint: typeof record.hint === 'string' ? record.hint : '',
  }
}

export const normalizeStartNodeConfig = (value: unknown): StartNodeConfig => {
  const record = isRecord(value) ? value : {}

  return {
    variables: Array.isArray(record.variables)
      ? record.variables.map(normalizeStartVariable)
      : [],
  }
}

export const getStartVariableTypeLabel = (value: StartVariableType) => {
  const labels: Record<StartVariableType, string> = {
    'text-input': 'Text',
    paragraph: 'Paragraph',
    select: 'Select',
    number: 'Number',
    url: 'URL',
    json: 'JSON',
    json_object: 'JSON Object',
    file: 'File',
    'file-list': 'File List',
    checkbox: 'Boolean',
  }

  return labels[value]
}

export const buildStartNodeOutputs = (config: StartNodeConfig): CanvasNodeData['outputs'] => {
  const customOutputs = config.variables.reduce<Record<string, unknown>>((acc, variable) => {
    const key = variable.variable.trim()
    if (!key)
      return acc

    switch (variable.type) {
      case 'number':
        acc[key] = 0
        break
      case 'checkbox':
        acc[key] = false
        break
      case 'json':
      case 'json_object':
        acc[key] = {}
        break
      case 'file-list':
        acc[key] = []
        break
      default:
        acc[key] = ''
    }

    return acc
  }, {})

  return {
    query: '',
    files: [],
    ...customOutputs,
  }
}

export const buildStartOutputTypes = (config: StartNodeConfig) => {
  return config.variables.reduce<Record<string, string>>((acc, variable) => {
    const key = variable.variable.trim()
    if (!key)
      return acc

    if (variable.type === 'number')
      acc[key] = 'number'
    else if (variable.type === 'checkbox')
      acc[key] = 'boolean'
    else if (variable.type === 'file')
      acc[key] = 'file'
    else if (variable.type === 'file-list')
      acc[key] = 'array'
    else if (variable.type === 'json' || variable.type === 'json_object')
      acc[key] = 'object'
    else
      acc[key] = 'string'

    return acc
  }, {
    query: 'string',
    files: 'file',
  })
}

export const validateStartNodeConfig = (config: StartNodeConfig): StartValidationIssue[] => {
  const issues: StartValidationIssue[] = []
  const seenVariables = new Set<string>()
  const seenLabels = new Set<string>()

  config.variables.forEach((variable, index) => {
    const normalizedVariable = variable.variable.trim()
    const normalizedLabel = variable.label.trim()
    const basePath = `variables.${index}`

    if (!normalizedVariable) {
      issues.push({
        path: `${basePath}.variable`,
        message: `第 ${index + 1} 个输入变量缺少变量名。`,
      })
    } else if (RESERVED_VARIABLE_NAMES.has(normalizedVariable)) {
      issues.push({
        path: `${basePath}.variable`,
        message: `${normalizedVariable} 是系统保留变量名，请换一个名称。`,
      })
    } else if (seenVariables.has(normalizedVariable)) {
      issues.push({
        path: `${basePath}.variable`,
        message: `输入变量 ${normalizedVariable} 重复，请改成唯一名称。`,
      })
    }

    if (!normalizedLabel) {
      issues.push({
        path: `${basePath}.label`,
        message: `第 ${index + 1} 个输入变量缺少展示名称。`,
      })
    } else if (seenLabels.has(normalizedLabel)) {
      issues.push({
        path: `${basePath}.label`,
        message: `变量标签 ${normalizedLabel} 重复，请改成唯一名称。`,
      })
    }

    if (variable.type === 'select' && !variable.options.length) {
      issues.push({
        path: `${basePath}.options`,
        message: `选择型变量 ${normalizedLabel || normalizedVariable || index + 1} 至少需要一个选项。`,
      })
    }

    seenVariables.add(normalizedVariable)
    seenLabels.add(normalizedLabel)
  })

  return issues
}