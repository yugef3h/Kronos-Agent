import {
  NodeRunStatus,
  type NodeDebugExecutor,
  type NodeDebugRequest,
  type NodeDebugResult,
  type RunError,
} from '../../types/types.js'

type EndOutputValueMode = 'variable' | 'constant'
type EndOutputConstantType = 'string' | 'number' | 'boolean' | 'json'

type EndOutputDefinition = {
  id: string
  variable: string
  value_selector: string[]
  variable_type: EndOutputValueMode
  value: string
  constant_type: EndOutputConstantType
}

type EndNodeConfig = {
  outputs: EndOutputDefinition[]
}

type EndValidationIssue = {
  path: string
  message: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

const normalizeEndOutput = (value: unknown): EndOutputDefinition => {
  const record = isRecord(value) ? value : {}
  const constantType = record.constant_type === 'number'
    || record.constant_type === 'boolean'
    || record.constant_type === 'json'
    || record.constant_type === 'string'
    ? record.constant_type
    : 'string'

  return {
    id: typeof record.id === 'string' && record.id ? record.id : `end-output-${Date.now()}`,
    variable: typeof record.variable === 'string' ? record.variable : '',
    value_selector: sanitizeStringArray(record.value_selector),
    variable_type: record.variable_type === 'constant' ? 'constant' : 'variable',
    value: typeof record.value === 'string' ? record.value : '',
    constant_type: constantType,
  }
}

export const normalizeEndNodeConfig = (
  value: unknown,
  existingOutputs?: Record<string, unknown>,
): EndNodeConfig => {
  const record = isRecord(value) ? value : {}

  if (!Array.isArray(record.outputs)) {
    const outputKeys = Object.keys(existingOutputs ?? {})
    if (!outputKeys.length) {
      return {
        outputs: [{
          ...normalizeEndOutput({ variable: 'result', variable_type: 'constant' }),
          variable: 'result',
          variable_type: 'constant',
        }],
      }
    }

    return {
      outputs: outputKeys.map((key) => ({
        ...normalizeEndOutput({ variable: key, variable_type: 'constant' }),
        variable: key,
        variable_type: 'constant',
      })),
    }
  }

  return {
    outputs: record.outputs.map(normalizeEndOutput),
  }
}

const parseEndConstantValue = (output: EndOutputDefinition) => {
  if (output.constant_type === 'number') {
    const parsed = Number(output.value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  if (output.constant_type === 'boolean') {
    return output.value === 'true'
  }

  if (output.constant_type === 'json') {
    try {
      return JSON.parse(output.value || '{}')
    } catch {
      return {}
    }
  }

  return output.value
}

export const buildEndNodeOutputs = (config: EndNodeConfig): Record<string, unknown> => {
  return config.outputs.reduce<Record<string, unknown>>((acc, output) => {
    const key = output.variable.trim()
    if (!key) {
      return acc
    }

    acc[key] = output.variable_type === 'constant' ? parseEndConstantValue(output) : ''
    return acc
  }, {})
}

export const validateEndNodeConfig = (config: EndNodeConfig): EndValidationIssue[] => {
  const issues: EndValidationIssue[] = []
  const seenVariables = new Set<string>()

  if (!config.outputs.length) {
    issues.push({
      path: 'outputs',
      message: '至少需要一个输出变量。',
    })
    return issues
  }

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

    if (output.variable_type === 'constant' && output.constant_type === 'json') {
      try {
        JSON.parse(output.value || '{}')
      } catch {
        issues.push({
          path: `${basePath}.value`,
          message: `输出变量 ${normalizedVariable || index + 1} 的 JSON 常量格式不合法。`,
        })
      }
    }

    if (normalizedVariable) {
      seenVariables.add(normalizedVariable)
    }
  })

  return issues
}

const resolveSelectorValue = (
  selector: string[],
  variables: Record<string, unknown> | undefined,
): { value: unknown; resolved: boolean } => {
  if (!selector.length) {
    return { value: '', resolved: false }
  }

  if (!variables) {
    return {
      value: `[mock:${selector.join('.')}]`,
      resolved: false,
    }
  }

  const dottedKey = selector.join('.')
  if (Object.prototype.hasOwnProperty.call(variables, dottedKey)) {
    return { value: variables[dottedKey], resolved: true }
  }

  let current: unknown = variables
  for (const segment of selector) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return {
        value: `[mock:${dottedKey}]`,
        resolved: false,
      }
    }

    current = current[segment]
  }

  return { value: current, resolved: true }
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

export const executeEndNodeDebug: NodeDebugExecutor = async (request) => {
  const startedAt = Date.now()
  const existingOutputs = isRecord(request.node.outputs) ? request.node.outputs : undefined
  const config = normalizeEndNodeConfig(request.node.inputs ?? request.node.data, existingOutputs)
  const configIssues = validateEndNodeConfig(config)

  if (configIssues.length > 0) {
    return buildFailedResult(request, startedAt, {
      code: 'end_config_invalid',
      message: configIssues[0]?.message ?? '结束节点配置无效',
      nodeId: request.node.id,
      details: { issues: configIssues },
    })
  }

  const contextVariables = isRecord(request.context?.variables)
    ? request.context.variables
    : undefined
  const runtimeInputOverrides = isRecord(request.inputs) ? request.inputs : {}
  const resolvedOutputs: Record<string, unknown> = {}
  const resolutionTrace: Array<{
    variable: string
    source: 'constant' | 'selector' | 'runtime_override'
    resolved: boolean
    value_selector?: string[]
  }> = []

  for (const output of config.outputs) {
    const key = output.variable.trim()
    if (!key) {
      continue
    }

    if (Object.prototype.hasOwnProperty.call(runtimeInputOverrides, key)) {
      resolvedOutputs[key] = runtimeInputOverrides[key]
      resolutionTrace.push({
        variable: key,
        source: 'runtime_override',
        resolved: true,
      })
      continue
    }

    if (output.variable_type === 'constant') {
      resolvedOutputs[key] = parseEndConstantValue(output)
      resolutionTrace.push({
        variable: key,
        source: 'constant',
        resolved: true,
      })
      continue
    }

    const { value, resolved } = resolveSelectorValue(output.value_selector, contextVariables)
    resolvedOutputs[key] = value
    resolutionTrace.push({
      variable: key,
      source: 'selector',
      resolved,
      value_selector: output.value_selector,
    })
  }

  const finishedAt = Date.now()

  return {
    nodeId: request.node.id,
    status: NodeRunStatus.Succeeded,
    startedAt,
    finishedAt,
    elapsedMs: Math.max(0, finishedAt - startedAt),
    inputs: {
      contextVariables: contextVariables ?? null,
      config: config.outputs,
    },
    outputs: {
      ...resolvedOutputs,
      _debug: {
        resolutionTrace,
        usedMockContext: !contextVariables,
      },
    },
  }
}
