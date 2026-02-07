import type { StartNodeConfig, StartVariable, StartVariableType } from './types'

export type StartPanelDebugFormValues = Record<string, string>

const coerceDebugValue = (type: StartVariableType, raw: string): unknown => {
  const trimmed = raw.trim()

  switch (type) {
    case 'number': {
      if (!trimmed) {
        return ''
      }

      const parsed = Number(trimmed)
      return Number.isFinite(parsed) ? parsed : raw
    }
    case 'checkbox':
      return trimmed === 'true' || trimmed === '1' || trimmed.toLowerCase() === 'yes'
    case 'json':
    case 'json_object':
      if (!trimmed) {
        return ''
      }

      try {
        return JSON.parse(trimmed) as unknown
      } catch {
        return raw
      }
    default:
      return raw
  }
}

export const buildStartPanelDebugInputs = (
  config: StartNodeConfig,
  values: StartPanelDebugFormValues,
): Record<string, unknown> => {
  const inputs: Record<string, unknown> = {}

  const query = values.query?.trim()
  if (query) {
    inputs.query = query
  }

  config.variables.forEach((variable) => {
    const key = variable.variable.trim()
    if (!key) {
      return
    }

    const raw = values[key]
    if (raw === undefined || raw.trim() === '') {
      return
    }

    inputs[key] = coerceDebugValue(variable.type, raw)
  })

  return inputs
}

export const mergeStartPanelDebugFormValues = (
  config: StartNodeConfig,
  previous: StartPanelDebugFormValues,
): StartPanelDebugFormValues => {
  const next: StartPanelDebugFormValues = {
    query: previous.query ?? '',
  }

  config.variables.forEach((variable: StartVariable) => {
    const key = variable.variable.trim()
    if (!key) {
      return
    }

    if (previous[key] !== undefined) {
      next[key] = previous[key]
    } else {
      next[key] = ''
    }
  })

  return next
}
