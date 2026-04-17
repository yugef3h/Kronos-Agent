import type { ValueSelector } from '../panels/llm-panel/types'
import { serializeValueSelector } from './variable-options'

const WORKFLOW_HASH_TOKEN_CLOSE = '#}}'

export const formatWorkflowVariableToken = (selector: ValueSelector): string =>
  `{{#${serializeValueSelector(selector)}#}}`

export type WorkflowVariableMenuTrigger =
  | { kind: 'single'; start: number; filter: string }
  | { kind: 'pair'; openStart: number; replaceEnd: number; filter: string }

/** 光标处 `{` / `/` 或未完成 `{{#…` 时触发 */
export const getWorkflowHashVariableTrigger = (
  value: string,
  selectionStart: number,
): { start: number; filter: string } | null => {
  const before = value.slice(0, selectionStart)

  for (let i = selectionStart - 1; i >= 0; i--) {
    const ch = before[i]

    if (ch === '{') {
      const slice = before.slice(i)

      if (slice.startsWith('{{#')) {
        const inner = slice.slice(3)
        const closeIdx = value.indexOf(WORKFLOW_HASH_TOKEN_CLOSE, i + 3)
        if (closeIdx !== -1 && selectionStart <= closeIdx + WORKFLOW_HASH_TOKEN_CLOSE.length) {
          continue
        }

        return { start: i, filter: inner }
      }

      if (i > 0 && before[i - 1] === '{') {
        continue
      }

      const inner = slice.slice(1)
      if (inner.includes('}')) {
        continue
      }

      return { start: i, filter: inner }
    }

    if (ch === '/') {
      if (i > 0 && before[i - 1] === '/') {
        continue
      }

      if (i > 0 && before[i - 1] === ':') {
        continue
      }

      const slice = before.slice(i)
      const inner = slice.slice(1)
      if (inner.includes('}')) {
        continue
      }

      const openHash = before.lastIndexOf('{{#', i)
      if (openHash !== -1) {
        const innerStart = openHash + 3
        const closeIdx = value.indexOf(WORKFLOW_HASH_TOKEN_CLOSE, innerStart)
        if (closeIdx !== -1 && i < closeIdx + WORKFLOW_HASH_TOKEN_CLOSE.length && selectionStart <= closeIdx + WORKFLOW_HASH_TOKEN_CLOSE.length) {
          continue
        }
      }

      return { start: i, filter: inner }
    }
  }

  return null
}

/** 光标在未闭合的 `{{#…` 内（尚无 `#}}`） */
export const getWorkflowPairInnerTrigger = (
  value: string,
  selectionStart: number,
): { openStart: number; replaceEnd: number; filter: string } | null => {
  let open = -1
  const hi = Math.min(selectionStart, value.length)

  for (let i = hi - 3; i >= 0; i--) {
    if (value.slice(i, i + 3) === '{{#') {
      open = i
      break
    }
  }

  if (open < 0 || selectionStart < open + 3) {
    return null
  }

  const innerStart = open + 3
  const close = value.indexOf(WORKFLOW_HASH_TOKEN_CLOSE, innerStart)

  if (close === -1) {
    const segment = value.slice(innerStart, selectionStart)
    if (segment.includes('#}}')) {
      return null
    }

    return { openStart: open, replaceEnd: selectionStart, filter: segment }
  }

  return null
}

export const resolveWorkflowVariableMenuTrigger = (
  value: string,
  selectionStart: number,
): WorkflowVariableMenuTrigger | null => {
  const pair = getWorkflowPairInnerTrigger(value, selectionStart)
  if (pair) {
    return { kind: 'pair', ...pair }
  }

  const single = getWorkflowHashVariableTrigger(value, selectionStart)
  if (single) {
    return { kind: 'single', start: single.start, filter: single.filter }
  }

  return null
}

export const WORKFLOW_PROMPT_VARIABLE_HIGHLIGHT_RE = /\{\{#([\w-]+(?:\.[\w-]+)*)#\}\}/g
