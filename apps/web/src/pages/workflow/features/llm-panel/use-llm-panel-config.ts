import { useMemo, useState } from 'react'
import { produce } from 'immer'
import {
  getCompletionParamDefinition,
  DEFAULT_VISION_SELECTOR,
  filterCompletionParamsByModel,
  getModelCatalogItem,
  isStructuredOutputModel,
  isVisionModel,
  MODEL_CATALOG,
  reconcileVisionConfig,
} from './catalog'
import {
  createEmptyStructuredOutput,
  createPromptTemplateForMode,
  normalizeLLMNodeConfig,
  validateLLMNodeConfig,
} from './schema'
import type {
  ChatPromptItem,
  CompletionParamKey,
  CompletionPromptItem,
  LLMNodeConfig,
  PromptRole,
  StructuredOutputConfig,
  ValueSelector,
  VariableOption,
} from './types'

type UseLLMPanelConfigOptions = {
  value: unknown
  availableVariables: VariableOption[]
  onChange: (nextValue: LLMNodeConfig) => void
}

const clampWindowSize = (value: number | null): number | null => {
  if (value === null || Number.isNaN(value))
    return null

  return Math.max(1, Math.min(100, value))
}

export const useLLMPanelConfig = ({ value, availableVariables, onChange }: UseLLMPanelConfigOptions) => {
  const config = useMemo(() => normalizeLLMNodeConfig(value), [value])
  const [lastMigrationNote, setLastMigrationNote] = useState<string | null>(null)
  const issues = useMemo(() => validateLLMNodeConfig(config), [config])
  const selectedModel = useMemo(
    () => getModelCatalogItem(config.model.provider, config.model.name),
    [config.model.name, config.model.provider],
  )

  const isChatModel = config.model.mode === 'chat'
  const isCompletionModel = !isChatModel
  const isVisionEnabledModel = isVisionModel(config)
  const isStructuredOutputEnabledModel = isStructuredOutputModel(config)
  const fileVariables = availableVariables.filter(variable => variable.valueType === 'file')

  const update = (recipe: (draft: LLMNodeConfig) => void) => {
    const nextValue = produce(config, recipe)
    onChange(nextValue)
  }

  const handleModelChange = (modelKey: string) => {
    const nextModel = MODEL_CATALOG.find(model => `${model.provider}:${model.name}` === modelKey)
    if (!nextModel)
      return

    update((draft) => {
      const modeChanged = draft.model.mode !== nextModel.mode
      const filteredParams = filterCompletionParamsByModel(draft.model.completionParams, nextModel)
      draft.model = {
        provider: nextModel.provider,
        name: nextModel.name,
        mode: nextModel.mode,
        completionParams: filteredParams.params,
      }

      if (modeChanged)
        draft.promptTemplate = createPromptTemplateForMode(nextModel.mode)

      draft.vision = reconcileVisionConfig(draft.vision, nextModel)

      if (draft.vision.enabled && !draft.vision.configs?.variableSelector.length) {
        draft.vision.configs = {
          detail: 'high',
          variableSelector: DEFAULT_VISION_SELECTOR,
        }
      }
    })

    const filteredParams = filterCompletionParamsByModel(config.model.completionParams, nextModel)
    setLastMigrationNote(
      filteredParams.removedKeys.length
        ? `已移除不兼容参数：${filteredParams.removedKeys.join(', ')}`
        : null,
    )
  }

  const handleCompletionParamChange = (key: CompletionParamKey, value: number | null) => {
    update((draft) => {
      if (value === null || Number.isNaN(value)) {
        delete draft.model.completionParams[key]
        return
      }

      draft.model.completionParams[key] = value
    })
  }

  const handleCompletionParamEnabledChange = (key: CompletionParamKey, enabled: boolean) => {
    update((draft) => {
      if (!enabled) {
        delete draft.model.completionParams[key]
        return
      }

      const definition = getCompletionParamDefinition(key)
      draft.model.completionParams[key] = definition?.defaultValue ?? 0
    })
  }

  const handleContextEnabledChange = (enabled: boolean) => {
    update((draft) => {
      draft.context.enabled = enabled
    })
  }

  const handleContextVariableChange = (variableSelector: ValueSelector) => {
    update((draft) => {
      draft.context.variableSelector = variableSelector
    })
  }

  const handlePromptItemChange = (
    index: number,
    patch: Partial<ChatPromptItem>,
  ) => {
    update((draft) => {
      if (!Array.isArray(draft.promptTemplate) || !draft.promptTemplate[index])
        return

      draft.promptTemplate[index] = {
        ...draft.promptTemplate[index],
        ...patch,
      }
    })
  }

  const handleCompletionPromptChange = (patch: Partial<CompletionPromptItem>) => {
    update((draft) => {
      if (Array.isArray(draft.promptTemplate))
        return

      draft.promptTemplate = {
        ...draft.promptTemplate,
        ...patch,
      }
    })
  }

  const handleAddPromptMessage = () => {
    update((draft) => {
      if (!Array.isArray(draft.promptTemplate))
        return

      const lastRole = draft.promptTemplate[draft.promptTemplate.length - 1]?.role
      const nextRole: PromptRole = !draft.promptTemplate.length
        ? 'system'
        : lastRole === 'user'
          ? 'assistant'
          : 'user'

      draft.promptTemplate.push({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        role: nextRole,
        text: '',
      })
    })
  }

  const handleRemovePromptMessage = (index: number) => {
    update((draft) => {
      if (!Array.isArray(draft.promptTemplate))
        return

      draft.promptTemplate.splice(index, 1)
      if (!draft.promptTemplate.length)
        draft.promptTemplate = createPromptTemplateForMode('chat') as ChatPromptItem[]
    })
  }

  const handleToggleMemory = (enabled: boolean) => {
    update((draft) => {
      draft.memory = enabled
        ? {
            window: { enabled: false, size: 50 },
            queryPromptTemplate: '{{#sys.query#}}\n\n{{#sys.files#}}',
            rolePrefix: draft.model.mode === 'completion'
              ? {
                  user: 'User',
                  assistant: 'Assistant',
                }
              : undefined,
          }
        : undefined
    })
  }

  const handleMemoryWindowEnabledChange = (enabled: boolean) => {
    update((draft) => {
      if (!draft.memory)
        return

      draft.memory.window.enabled = enabled
    })
  }

  const handleMemoryWindowSizeChange = (size: number | null) => {
    update((draft) => {
      if (!draft.memory)
        return

      draft.memory.window.size = clampWindowSize(size) ?? 50
    })
  }

  const handleMemoryQueryChange = (queryPromptTemplate: string) => {
    update((draft) => {
      if (!draft.memory)
        return

      draft.memory.queryPromptTemplate = queryPromptTemplate
    })
  }

  const handleRolePrefixChange = (role: 'user' | 'assistant', value: string) => {
    update((draft) => {
      if (!draft.memory)
        return

      draft.memory.rolePrefix = draft.memory.rolePrefix ?? {
        user: 'User',
        assistant: 'Assistant',
      }
      draft.memory.rolePrefix[role] = value
    })
  }

  const handleVisionEnabledChange = (enabled: boolean) => {
    update((draft) => {
      draft.vision.enabled = enabled
      draft.vision.configs = enabled
        ? {
            detail: draft.vision.configs?.detail ?? 'high',
            variableSelector: draft.vision.configs?.variableSelector?.length
              ? draft.vision.configs.variableSelector
              : DEFAULT_VISION_SELECTOR,
          }
        : undefined
    })
  }

  const handleVisionVariableChange = (variableSelector: ValueSelector) => {
    update((draft) => {
      draft.vision.configs = {
        detail: draft.vision.configs?.detail ?? 'high',
        variableSelector,
      }
      draft.vision.enabled = true
    })
  }

  const handleVisionDetailChange = (detail: 'high' | 'low' | 'auto') => {
    update((draft) => {
      draft.vision.configs = {
        detail,
        variableSelector: draft.vision.configs?.variableSelector?.length
          ? draft.vision.configs.variableSelector
          : DEFAULT_VISION_SELECTOR,
      }
      draft.vision.enabled = true
    })
  }

  const handleReasoningFormatChange = (enabled: boolean) => {
    update((draft) => {
      draft.reasoningFormat = enabled ? 'separated' : 'tagged'
    })
  }

  const handleStructuredOutputEnabledChange = (enabled: boolean) => {
    update((draft) => {
      draft.structuredOutputEnabled = enabled
      draft.structuredOutput = enabled
        ? (draft.structuredOutput ?? createEmptyStructuredOutput())
        : undefined
    })
  }

  const handleStructuredOutputChange = (nextOutput: StructuredOutputConfig) => {
    update((draft) => {
      draft.structuredOutput = nextOutput
      draft.structuredOutputEnabled = true
    })
  }

  return {
    config,
    issues,
    modelOptions: MODEL_CATALOG,
    selectedModel,
    lastMigrationNote,
    isChatModel,
    isCompletionModel,
    isVisionEnabledModel,
    isStructuredOutputEnabledModel,
    fileVariables,
    handleModelChange,
    handleCompletionParamChange,
    handleCompletionParamEnabledChange,
    handleContextEnabledChange,
    handleContextVariableChange,
    handlePromptItemChange,
    handleCompletionPromptChange,
    handleAddPromptMessage,
    handleRemovePromptMessage,
    handleToggleMemory,
    handleMemoryWindowEnabledChange,
    handleMemoryWindowSizeChange,
    handleMemoryQueryChange,
    handleRolePrefixChange,
    handleVisionEnabledChange,
    handleVisionVariableChange,
    handleVisionDetailChange,
    handleReasoningFormatChange,
    handleStructuredOutputEnabledChange,
    handleStructuredOutputChange,
  }
}