const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const LOOP_NODE_MAX_COUNT = 100

export type LoopNodeConfig = {
  start_node_id: string
  loop_count: number
}

const normalizeLoopCount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(parsed)) {
    return 10
  }

  return Math.min(Math.max(Math.round(parsed), 1), LOOP_NODE_MAX_COUNT)
}

export const normalizeLoopNodeConfig = (value: unknown, nodeId?: string): LoopNodeConfig => {
  const record = isRecord(value) ? value : {}
  const fallbackStartId = nodeId ? `${nodeId}__loop_start` : ''

  return {
    start_node_id: typeof record.start_node_id === 'string' && record.start_node_id.trim()
      ? record.start_node_id
      : fallbackStartId,
    loop_count: normalizeLoopCount(record.loop_count),
  }
}
