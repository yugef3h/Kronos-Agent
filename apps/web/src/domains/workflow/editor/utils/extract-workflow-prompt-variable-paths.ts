import { WORKFLOW_PROMPT_VARIABLE_HIGHLIGHT_RE } from './workflow-prompt-variable-utils'

export const extractWorkflowPromptVariablePaths = (texts: string[]): string[] => {
  const paths = new Set<string>()
  const re = new RegExp(WORKFLOW_PROMPT_VARIABLE_HIGHLIGHT_RE.source, 'g')

  for (const text of texts) {
    if (!text.trim()) {
      continue
    }

    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      paths.add(match[1])
    }
  }

  return [...paths].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

export const collectLlmPanelPromptTexts = (config: {
  promptTemplate: unknown
  memory?: { queryPromptTemplate?: string } | null
}): string[] => {
  const texts: string[] = []

  if (Array.isArray(config.promptTemplate)) {
    for (const item of config.promptTemplate) {
      if (item && typeof item === 'object' && typeof (item as { text?: string }).text === 'string') {
        texts.push((item as { text: string }).text)
      }
    }
  } else if (config.promptTemplate && typeof config.promptTemplate === 'object') {
    const text = (config.promptTemplate as { text?: string }).text
    if (typeof text === 'string') {
      texts.push(text)
    }
  }

  if (typeof config.memory?.queryPromptTemplate === 'string') {
    texts.push(config.memory.queryPromptTemplate)
  }

  return texts
}
