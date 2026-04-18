import type { LlmDebugVariableField } from './llm-debug-context'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseDebugFieldValue = (field: LlmDebugVariableField, rawValue: string): unknown => {
  const trimmed = rawValue.trim()
  if (!trimmed) {
    return ''
  }

  if (field.kind !== 'json') {
    return trimmed
  }

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return trimmed
  }
}

const setNestedContextValue = (
  root: Record<string, unknown>,
  path: string,
  value: unknown,
) => {
  const segments = path.split('.').filter(Boolean)
  if (!segments.length) {
    return
  }

  let current: Record<string, unknown> = root
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    const next = current[segment]
    if (!isRecord(next)) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }

  current[segments[segments.length - 1]] = value
}

/** 将 `sys.query` 等扁平路径写入嵌套对象，供单节点调试 context.variables 使用 */
export const buildPanelDebugContextFromFieldValues = (
  fieldValues: Record<string, string>,
): Record<string, unknown> => {
  const root: Record<string, unknown> = {}

  for (const [path, rawValue] of Object.entries(fieldValues)) {
    const trimmedPath = path.trim()
    if (!trimmedPath) {
      continue
    }

    if (!rawValue.trim()) {
      continue
    }

    setNestedContextValue(root, trimmedPath, rawValue.trim())
  }

  return root
}

export const buildPanelDebugContextFromLlmFields = (
  fields: LlmDebugVariableField[],
  fieldValues: Record<string, string>,
): Record<string, unknown> => {
  const root: Record<string, unknown> = {}

  for (const field of fields) {
    const rawValue = fieldValues[field.path] ?? ''
    if (!rawValue.trim()) {
      continue
    }

    setNestedContextValue(root, field.path, parseDebugFieldValue(field, rawValue))
  }

  return root
}
