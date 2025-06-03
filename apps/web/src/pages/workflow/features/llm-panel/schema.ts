import type {
  ChatPromptItem,
  CompletionPromptItem,
  LLMNodeConfig,
  ModelMode,
  StructuredOutputConfig,
  ValidationIssue,
} from './types'
import {
  getModelCatalogItem,
  VIRTUAL_MODEL_NAME,
  VIRTUAL_MODEL_PROVIDER,
} from './catalog'

const createId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const createPromptTemplateForMode = (
  mode: ModelMode,
): ChatPromptItem[] | CompletionPromptItem => {
  if (mode === 'completion') {
    return {
      text: '',
    }
  }

  return [
    {
      id: createId(),
      role: 'system',
      text: '',
    },
  ]
}

export const createEmptyStructuredOutput = (): StructuredOutputConfig => ({
  schema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
})

export const createDefaultLLMNodeConfig = (): LLMNodeConfig => ({
  model: {
    provider: VIRTUAL_MODEL_PROVIDER,
    name: VIRTUAL_MODEL_NAME,
    mode: 'chat',
    completionParams: {
      temperature: 0.7,
      topP: 1,
      topK: 1,
      maxTokens: 1024,
    },
  },
  promptTemplate: createPromptTemplateForMode('chat'),
  context: {
    enabled: false,
    variableSelector: [],
  },
  vision: {
    enabled: false,
  },
})

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const normalizeChatPromptItem = (value: unknown): ChatPromptItem | null => {
  if (!isRecord(value))
    return null

  return {
    id: typeof value.id === 'string' ? value.id : createId(),
    role: value.role === 'assistant' || value.role === 'user' ? value.role : 'system',
    text: typeof value.text === 'string'
      ? value.text
      : typeof value.jinja2Text === 'string'
        ? value.jinja2Text
        : '',
  }
}

export const normalizeLLMNodeConfig = (value: unknown): LLMNodeConfig => {
  const defaults = createDefaultLLMNodeConfig()

  if (!isRecord(value))
    return defaults

  const modelRecord = isRecord(value.model) ? value.model : {}
  const mode = modelRecord.mode === 'completion' ? 'completion' : 'chat'
  const normalizedProvider = typeof modelRecord.provider === 'string' ? modelRecord.provider : defaults.model.provider
  const normalizedName = typeof modelRecord.name === 'string' ? modelRecord.name : defaults.model.name
  const hasKnownModel = !!getModelCatalogItem(normalizedProvider, normalizedName)
  const promptTemplate: ChatPromptItem[] | CompletionPromptItem = Array.isArray(value.promptTemplate)
    ? value.promptTemplate.map(normalizeChatPromptItem).filter(Boolean) as ChatPromptItem[]
    : isRecord(value.promptTemplate)
      ? {
          text: typeof value.promptTemplate.text === 'string'
            ? value.promptTemplate.text
            : typeof value.promptTemplate.jinja2Text === 'string'
              ? value.promptTemplate.jinja2Text
              : '',
        }
      : createPromptTemplateForMode(mode)

  return {
    model: {
      provider: hasKnownModel ? normalizedProvider : defaults.model.provider,
      name: hasKnownModel ? normalizedName : defaults.model.name,
      mode,
      completionParams: isRecord(modelRecord.completionParams)
        ? {
            ...defaults.model.completionParams,
            ...modelRecord.completionParams,
          }
        : defaults.model.completionParams,
    },
    promptTemplate:
      mode === 'chat'
        ? (Array.isArray(promptTemplate) && promptTemplate.length
            ? promptTemplate
            : createPromptTemplateForMode('chat'))
        : (!Array.isArray(promptTemplate)
            ? promptTemplate
            : createPromptTemplateForMode('completion')),
    memory: isRecord(value.memory)
      ? {
          rolePrefix: isRecord(value.memory.rolePrefix)
            ? {
                user: typeof value.memory.rolePrefix.user === 'string' ? value.memory.rolePrefix.user : 'User',
                assistant: typeof value.memory.rolePrefix.assistant === 'string' ? value.memory.rolePrefix.assistant : 'Assistant',
              }
            : undefined,
          window: isRecord(value.memory.window)
            ? {
                enabled: value.memory.window.enabled !== false,
                size: typeof value.memory.window.size === 'number' ? value.memory.window.size : 50,
              }
            : { enabled: false, size: 50 },
          queryPromptTemplate: typeof value.memory.queryPromptTemplate === 'string'
            ? value.memory.queryPromptTemplate
            : '{{#sys.query#}}\n\n{{#sys.files#}}',
        }
      : undefined,
    context: isRecord(value.context)
      ? {
          enabled: value.context.enabled === true,
          variableSelector: Array.isArray(value.context.variableSelector)
            ? value.context.variableSelector.filter(part => typeof part === 'string')
            : [],
        }
      : defaults.context,
    vision: isRecord(value.vision)
      ? {
          enabled: value.vision.enabled === true,
          configs: isRecord(value.vision.configs)
            ? {
                detail:
                  value.vision.configs.detail === 'low' || value.vision.configs.detail === 'auto'
                    ? value.vision.configs.detail
                    : 'high',
                variableSelector: Array.isArray(value.vision.configs.variableSelector)
                  ? value.vision.configs.variableSelector.filter(part => typeof part === 'string')
                  : [],
              }
            : undefined,
        }
      : defaults.vision,
    structuredOutputEnabled: value.structuredOutputEnabled === true,
    structuredOutput: isRecord(value.structuredOutput) && isRecord(value.structuredOutput.schema)
      ? {
          schema: {
            type: 'object',
            properties: isRecord(value.structuredOutput.schema.properties)
              ? value.structuredOutput.schema.properties as StructuredOutputConfig['schema']['properties']
              : {},
            required: Array.isArray(value.structuredOutput.schema.required)
              ? value.structuredOutput.schema.required.filter(item => typeof item === 'string')
              : [],
            additionalProperties: false,
          },
        }
      : undefined,
    reasoningFormat: value.reasoningFormat === 'separated' ? 'separated' : 'tagged',
  }
}

export const hasPromptContent = (config: LLMNodeConfig): boolean => {
  if (config.model.mode === 'chat') {
    return (config.promptTemplate as ChatPromptItem[]).some(item => !!item.text.trim())
  }

  const prompt = config.promptTemplate as CompletionPromptItem
  return !!prompt.text.trim()
}

export const validateLLMNodeConfig = (config: LLMNodeConfig): ValidationIssue[] => {
  const issues: ValidationIssue[] = []

  if (!config.model.provider || !config.model.name)
    issues.push({ path: 'model', message: 'Model is required.' })

  if (!config.memory && !hasPromptContent(config))
    issues.push({ path: 'promptTemplate', message: 'Prompt is required.' })

  if (config.memory && config.model.mode === 'chat' && !config.memory.queryPromptTemplate.includes('{{#sys.query#}}')) {
    issues.push({
      path: 'memory.queryPromptTemplate',
      message: 'Memory query prompt must contain {{#sys.query#}}.',
    })
  }

  if (config.vision.enabled && !config.vision.configs?.variableSelector.length) {
    issues.push({
      path: 'vision.configs.variableSelector',
      message: 'Vision variable is required.',
    })
  }

  return issues
}