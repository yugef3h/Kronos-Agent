import type { VariableOption } from '../panels/llm-panel/types'
import { serializeValueSelector } from './variable-options'

export type WorkflowVariableMenuGroup = {
  key: string
  title: string
  tone: 'slate' | 'blue' | 'emerald' | 'amber'
  options: Array<VariableOption & { displayLabel: string; typeLabel: string; path: string }>
}

const resolveOptionDisplayLabel = (option: VariableOption) => {
  if (option.source === 'system') {
    return option.valueSelector[1] ?? option.label
  }

  const separatorIndex = option.label.lastIndexOf('.')
  return separatorIndex >= 0 ? option.label.slice(separatorIndex + 1) : option.label
}

const resolveGroupMeta = (option: VariableOption) => {
  if (option.source === 'system') {
    const variableKey = option.valueSelector[1] ?? ''
    if (variableKey === 'query' || variableKey === 'files') {
      return {
        key: 'user-input',
        title: '用户输入',
        tone: 'emerald' as const,
      }
    }

    return {
      key: 'system',
      title: 'SYSTEM',
      tone: 'amber' as const,
    }
  }

  const separatorIndex = option.label.lastIndexOf('.')
  const title = separatorIndex >= 0 ? option.label.slice(0, separatorIndex) : option.label
  const normalizedTitle = title.toLowerCase()

  if (normalizedTitle.includes('llm')) {
    return {
      key: `node-${title}`,
      title,
      tone: 'blue' as const,
    }
  }

  if (title.includes('知识')) {
    return {
      key: `node-${title}`,
      title,
      tone: 'emerald' as const,
    }
  }

  return {
    key: `node-${title}`,
    title,
    tone: 'slate' as const,
  }
}

const resolveTypeLabel = (option: VariableOption) => {
  const variableKey = option.valueSelector[option.valueSelector.length - 1] ?? ''

  switch (option.valueType) {
    case 'string':
      return 'String'
    case 'number':
      return 'Number'
    case 'boolean':
      return 'Boolean'
    case 'object':
      return 'Object'
    case 'file':
      return variableKey.includes('files') ? 'Array[File]' : 'File'
    case 'array':
      return variableKey.includes('file') ? 'Array[File]' : 'Array[Object]'
    default:
      return option.valueType || 'String'
  }
}

const GROUP_TONE_STYLES: Record<WorkflowVariableMenuGroup['tone'], string> = {
  slate: 'text-slate-500',
  blue: 'text-blue-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
}

export { GROUP_TONE_STYLES }

export const buildWorkflowVariableMenuGroups = (
  options: VariableOption[],
  filter: string,
): WorkflowVariableMenuGroup[] => {
  const normalizedFilter = filter.trim().toLowerCase()
  const groups = new Map<string, WorkflowVariableMenuGroup>()

  options.forEach((option) => {
    const path = serializeValueSelector(option.valueSelector)
    const displayLabel = resolveOptionDisplayLabel(option)
    const typeLabel = resolveTypeLabel(option)
    const groupMeta = resolveGroupMeta(option)
    const searchableText =
      `${groupMeta.title} ${displayLabel} ${typeLabel} ${option.label} ${path}`.toLowerCase()

    if (normalizedFilter && !searchableText.includes(normalizedFilter)) {
      return
    }

    const groupedOption = {
      ...option,
      displayLabel,
      typeLabel,
      path,
    }

    const existingGroup = groups.get(groupMeta.key)
    if (existingGroup) {
      existingGroup.options.push(groupedOption)
      return
    }

    groups.set(groupMeta.key, {
      ...groupMeta,
      options: [groupedOption],
    })
  })

  return Array.from(groups.values())
}
