import type { VariableOption } from '../llm-panel/types'
import { buildContainerChildren, buildContainerStartNodeId } from '../container-panel/runtime'
import type {
  IterationErrorHandleMode,
  IterationNodeConfig,
  IterationOutputType,
  IterationValidationIssue,
} from './types'

export const ITERATION_PARALLEL_MAX = 50

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value))
    return []

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

const clampParallelNums = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(parsed))
    return 10

  return Math.min(Math.max(Math.round(parsed), 1), ITERATION_PARALLEL_MAX)
}

const normalizeErrorHandleMode = (value: unknown): IterationErrorHandleMode => {
  return ['terminated', 'continue_on_error', 'remove_abnormal_output'].includes(String(value))
    ? value as IterationErrorHandleMode
    : 'terminated'
}

const normalizeOutputType = (value: unknown): IterationOutputType => {
  return ['array', 'arrayString', 'arrayNumber', 'arrayObject', 'arrayFile', 'arrayBoolean'].includes(String(value))
    ? value as IterationOutputType
    : 'array'
}

export const deriveIterationOutputType = (option?: VariableOption): IterationOutputType => {
  if (!option)
    return 'array'

  switch (option.valueType) {
    case 'string':
      return 'arrayString'
    case 'number':
      return 'arrayNumber'
    case 'file':
      return 'arrayFile'
    case 'boolean':
      return 'arrayBoolean'
    case 'object':
      return 'arrayObject'
    default:
      return 'array'
  }
}

export const createDefaultIterationNodeConfig = (nodeId?: string): IterationNodeConfig => {
  return {
    start_node_id: buildContainerStartNodeId(nodeId, 'iteration'),
    iterator_selector: [],
    output_selector: [],
    output_type: 'array',
    is_parallel: false,
    parallel_nums: 10,
    error_handle_mode: 'terminated',
    flatten_output: true,
    isInIteration: false,
    isInLoop: false,
  }
}

export const normalizeIterationNodeConfig = (value: unknown, nodeId?: string): IterationNodeConfig => {
  const record = isRecord(value) ? value : {}
  const defaults = createDefaultIterationNodeConfig(nodeId)

  return {
    start_node_id: typeof record.start_node_id === 'string' && record.start_node_id.trim()
      ? record.start_node_id
      : defaults.start_node_id,
    iterator_selector: sanitizeStringArray(record.iterator_selector),
    output_selector: sanitizeStringArray(record.output_selector),
    output_type: normalizeOutputType(record.output_type),
    is_parallel: Boolean(record.is_parallel),
    parallel_nums: clampParallelNums(record.parallel_nums),
    error_handle_mode: normalizeErrorHandleMode(record.error_handle_mode),
    flatten_output: record.flatten_output === undefined ? true : Boolean(record.flatten_output),
    isInIteration: Boolean(record.isInIteration),
    isInLoop: Boolean(record.isInLoop),
  }
}

export const buildIterationChildren = (startNodeId: string) => {
  return buildContainerChildren('iteration', startNodeId)
}

export const getIterationErrorHandleLabel = (mode: IterationErrorHandleMode) => {
  switch (mode) {
    case 'continue_on_error':
      return '跳过异常轮次'
    case 'remove_abnormal_output':
      return '删除异常输出'
    default:
      return '立即终止'
  }
}

export const getIterationOutputTypeLabel = (outputType: IterationOutputType) => {
  switch (outputType) {
    case 'arrayString':
      return 'Array[String]'
    case 'arrayNumber':
      return 'Array[Number]'
    case 'arrayObject':
      return 'Array[Object]'
    case 'arrayFile':
      return 'Array[File]'
    case 'arrayBoolean':
      return 'Array[Boolean]'
    default:
      return 'Array'
  }
}

export const validateIterationNodeConfig = (config: IterationNodeConfig): IterationValidationIssue[] => {
  const issues: IterationValidationIssue[] = []

  if (!config.start_node_id.trim()) {
    issues.push({
      path: 'start_node_id',
      message: 'Iteration 容器缺少内部 start_node_id。',
    })
  }

  if (!config.iterator_selector.length) {
    issues.push({
      path: 'iterator_selector',
      message: '请选择一个可迭代数组变量。',
    })
  }

  if (!config.output_selector.length) {
    issues.push({
      path: 'output_selector',
      message: '请选择每轮聚合后的输出变量。',
    })
  }

  if (config.is_parallel && (config.parallel_nums < 1 || config.parallel_nums > ITERATION_PARALLEL_MAX)) {
    issues.push({
      path: 'parallel_nums',
      message: `并行度必须在 1 到 ${ITERATION_PARALLEL_MAX} 之间。`,
    })
  }

  return issues
}