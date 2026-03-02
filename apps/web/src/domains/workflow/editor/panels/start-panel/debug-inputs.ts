import { validateStartNodeConfig } from './schema'
import type { StartNodeConfig, StartVariable, StartVariableType } from './types'

export type StartPanelDebugFormValues = Record<string, string>

export type StartPanelDebugFieldIssue = {
  path: string
  message: string
}

const CONFIG_ISSUE_PATH = '__config__'

export const validateStartPanelDebugFormValues = (
  config: StartNodeConfig,
  values: StartPanelDebugFormValues,
): StartPanelDebugFieldIssue[] => {
  const issues: StartPanelDebugFieldIssue[] = []

  validateStartNodeConfig(config).forEach((issue) => {
    issues.push({
      path: CONFIG_ISSUE_PATH,
      message: issue.message,
    })
  })

  if (!values.query?.trim()) {
    issues.push({
      path: 'query',
      message: '请填写用户问题 (query)。',
    })
  }

  config.variables.forEach((variable) => {
    const key = variable.variable.trim()
    if (!key) {
      return
    }

    const raw = values[key] ?? ''

    if (variable.required && !raw.trim()) {
      issues.push({
        path: key,
        message: `${variable.label || key} 为必填项。`,
      })
      return
    }

    if (!raw.trim()) {
      return
    }

    if (variable.type === 'number') {
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        issues.push({
          path: key,
          message: `${variable.label || key} 请输入合法数字。`,
        })
      }
      return
    }

    if (variable.type === 'json' || variable.type === 'json_object') {
      try {
        JSON.parse(raw)
      } catch {
        issues.push({
          path: key,
          message: `${variable.label || key} 请输入合法 JSON。`,
        })
      }
    }
  })

  return issues
}

export const mapStartPanelDebugIssuesToFieldErrors = (
  issues: StartPanelDebugFieldIssue[],
): Record<string, string> => {
  return issues.reduce<Record<string, string>>((acc, issue) => {
    if (issue.path === CONFIG_ISSUE_PATH) {
      return acc
    }

    acc[issue.path] = issue.message
    return acc
  }, {})
}

export const getStartPanelDebugConfigIssueMessages = (
  issues: StartPanelDebugFieldIssue[],
): string[] => {
  return issues
    .filter((issue) => issue.path === CONFIG_ISSUE_PATH)
    .map((issue) => issue.message)
}

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
