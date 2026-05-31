import type { VariableSelector } from '../runner/runContext.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export type IterationNodeConfig = {
  start_node_id: string
  iterator_selector: VariableSelector
  output_selector: VariableSelector
}

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

export const normalizeIterationNodeConfig = (value: unknown, nodeId?: string): IterationNodeConfig => {
  const record = isRecord(value) ? value : {}
  const fallbackStartId = nodeId ? `${nodeId}__iteration_start` : ''

  return {
    start_node_id: typeof record.start_node_id === 'string' && record.start_node_id.trim()
      ? record.start_node_id
      : fallbackStartId,
    iterator_selector: sanitizeStringArray(record.iterator_selector),
    output_selector: sanitizeStringArray(record.output_selector),
  }
}
