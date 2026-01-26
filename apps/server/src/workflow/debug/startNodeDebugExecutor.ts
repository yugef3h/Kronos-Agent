import {
  NodeRunStatus,
  type NodeDebugExecutor,
  type NodeDebugRequest,
  type NodeDebugResult,
  type RunError,
} from '../types.js'

type StartVariableType =
  | 'text-input'
  | 'paragraph'
  | 'select'
  | 'number'
  | 'url'
  | 'json'
  | 'json_object'
  | 'file'
  | 'file-list'
  | 'checkbox'

type StartVariable = {
  id: string
  variable: string
  label: string
  type: StartVariableType
  required: boolean
  options: string[]
}

type StartNodeConfig = {
  variables: StartVariable[]
}

type StartValidationIssue = {
  path: string
  message: string
}

const RESERVED_VARIABLE_NAMES = new Set(['query', 'files', 'conversation_id'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeVariableType = (value: unknown): StartVariableType => {
  const normalized = String(value)
  if ([
    'text-input',
    'paragraph',
    'select',
    'number',
    'url',
    'json',
    'json_object',
    'file',
    'file-list',
    'checkbox',
  ].includes(normalized)) {
    return normalized as StartVariableType
  }

  return 'text-input'
}

const normalizeStartVariable = (value: unknown): StartVariable => {
  const record = isRecord(value) ? value : {}
  const type = normalizeVariableType(record.type)

  return {
    id: typeof record.id === 'string' && record.id ? record.id : `start-var-${Date.now()}`,
    variable: typeof record.variable === 'string' ? record.variable : '',
    label: typeof record.label === 'string' ? record.label : '',
    type,
    required: Boolean(record.required),
    options: type === 'select' && Array.isArray(record.options)
      ? record.options.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
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

export const buildStartNodeOutputs = (config: StartNodeConfig): Record<string, unknown> => {
  const customOutputs = config.variables.reduce<Record<string, unknown>>((acc, variable) => {
    const key = variable.variable.trim()
    if (!key) {
      return acc
    }

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

export const validateStartNodeConfig = (config: StartNodeConfig): StartValidationIssue[] => {
  const issues: StartValidationIssue[] = []
  const seenVariables = new Set<string>()

  config.variables.forEach((variable, index) => {
    const normalizedVariable = variable.variable.trim()
    const basePath = `variables.${index}`

    if (!normalizedVariable) {
      issues.push({
        path: basePath,
        message: `第 ${index + 1} 个输入变量缺少变量名。`,
      })
    } else if (RESERVED_VARIABLE_NAMES.has(normalizedVariable)) {
      issues.push({
        path: basePath,
        message: `${normalizedVariable} 是系统保留变量名，请换一个名称。`,
      })
    } else if (seenVariables.has(normalizedVariable)) {
      issues.push({
        path: basePath,
        message: `输入变量 ${normalizedVariable} 重复，请改成唯一名称。`,
      })
    } else if (variable.type === 'select' && !variable.options.length) {
      issues.push({
        path: `${basePath}.options`,
        message: `选择型变量 ${normalizedVariable} 至少需要一个选项。`,
      })
    }

    if (normalizedVariable) {
      seenVariables.add(normalizedVariable)
    }
  })

  return issues
}

const isEmptyRuntimeValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  return false
}

const validateRequiredRuntimeInputs = (
  config: StartNodeConfig,
  runtimeInputs: Record<string, unknown>,
): StartValidationIssue[] => {
  const issues: StartValidationIssue[] = []

  config.variables.forEach((variable) => {
    if (!variable.required) {
      return
    }

    const key = variable.variable.trim()
    if (!key) {
      return
    }

    if (isEmptyRuntimeValue(runtimeInputs[key])) {
      issues.push({
        path: `inputs.${key}`,
        message: `必填变量 ${key} 未提供有效值。`,
      })
    }
  })

  return issues
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

export const executeStartNodeDebug: NodeDebugExecutor = async (request) => {
  const startedAt = Date.now()
  const config = normalizeStartNodeConfig(request.node.inputs ?? request.node.data)
  const configIssues = validateStartNodeConfig(config)

  if (configIssues.length > 0) {
    return buildFailedResult(request, startedAt, {
      code: 'start_config_invalid',
      message: configIssues[0]?.message ?? '开始节点配置无效',
      nodeId: request.node.id,
      details: { issues: configIssues },
    })
  }

  const defaultOutputs = buildStartNodeOutputs(config)
  const runtimeInputs = {
    ...defaultOutputs,
    ...(isRecord(request.inputs) ? request.inputs : {}),
  }

  const requiredIssues = validateRequiredRuntimeInputs(config, runtimeInputs)
  if (requiredIssues.length > 0) {
    return buildFailedResult(request, startedAt, {
      code: 'start_inputs_invalid',
      message: requiredIssues[0]?.message ?? '开始节点输入无效',
      nodeId: request.node.id,
      details: { issues: requiredIssues },
    })
  }

  const finishedAt = Date.now()
  const conversationId = typeof request.context?.variables?.['sys.conversation_id'] === 'string'
    ? request.context.variables['sys.conversation_id']
    : `debug_${finishedAt.toString(36)}`

  const outputs = {
    ...runtimeInputs,
    'sys.query': typeof runtimeInputs.query === 'string' ? runtimeInputs.query : String(runtimeInputs.query ?? ''),
    'sys.files': Array.isArray(runtimeInputs.files) ? runtimeInputs.files : [],
    'sys.conversation_id': conversationId,
  }

  return {
    nodeId: request.node.id,
    status: NodeRunStatus.Succeeded,
    startedAt,
    finishedAt,
    elapsedMs: Math.max(0, finishedAt - startedAt),
    inputs: isRecord(request.inputs) ? request.inputs : runtimeInputs,
    outputs,
  }
}
