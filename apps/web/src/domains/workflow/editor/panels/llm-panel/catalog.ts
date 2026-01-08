import type {
  CompletionParamDefinition,
  CompletionParamKey,
  LLMNodeConfig,
  ModelCatalogItem,
  ModelMode,
  ValueSelector,
  VisionConfig,
} from './types'

export const VIRTUAL_MODEL_PROVIDER = 'virtual'
export const VIRTUAL_MODEL_NAME = 'zhiling'

export const MODEL_CATALOG: ModelCatalogItem[] = [
  {
    provider: VIRTUAL_MODEL_PROVIDER,
    name: VIRTUAL_MODEL_NAME,
    label: '智灵',
    mode: 'chat',
    features: ['vision', 'structured_output', 'reasoning'],
    supportedCompletionParams: ['temperature', 'maxTokens', 'topP', 'topK'],
  },
]

export const COMPLETION_PARAM_DEFINITIONS: CompletionParamDefinition[] = [
  {
    key: 'temperature',
    label: '温度',
    description: '控制回复的发散程度。',
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: 0.7,
  },
  {
    key: 'topP',
    label: 'Top P',
    description: '按累计概率裁剪候选 token。',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 1,
  },
  {
    key: 'topK',
    label: 'Top K',
    description: '限制每轮采样时参与竞争的候选数。',
    min: 1,
    max: 100,
    step: 1,
    defaultValue: 1,
  },
  {
    key: 'maxTokens',
    label: 'Max Tokens',
    description: '限制单次生成的最大 token 数。',
    min: 1,
    max: 8192,
    step: 1,
    defaultValue: 1024,
    inputMax: 32768,
  },
]

export const DEFAULT_VISION_SELECTOR: ValueSelector = ['sys', 'files']

export const getCompletionParamDefinition = (
  key: CompletionParamKey,
): CompletionParamDefinition | undefined => {
  return COMPLETION_PARAM_DEFINITIONS.find(param => param.key === key)
}

export const getModelCatalogItem = (
  provider: string,
  name: string,
): ModelCatalogItem | undefined => {
  return MODEL_CATALOG.find(model => model.provider === provider && model.name === name)
}

export const getDefaultModelForMode = (mode: ModelMode): ModelCatalogItem => {
  return MODEL_CATALOG.find(model => model.mode === mode) ?? MODEL_CATALOG[0]
}

export const filterCompletionParamsByModel = (
  params: Record<string, unknown>,
  model: ModelCatalogItem,
): { params: Record<string, unknown>; removedKeys: string[] } => {
  const supportedKeys = new Set<string>(model.supportedCompletionParams)
  const nextParams = Object.fromEntries(
    Object.entries(params).filter(([key]) => supportedKeys.has(key)),
  )
  const removedKeys = Object.keys(params).filter(key => !supportedKeys.has(key))

  return {
    params: nextParams,
    removedKeys,
  }
}

export const isVisionModel = (config: LLMNodeConfig): boolean => {
  const model = getModelCatalogItem(config.model.provider, config.model.name)
  return !!model?.features.includes('vision')
}

export const isStructuredOutputModel = (config: LLMNodeConfig): boolean => {
  const model = getModelCatalogItem(config.model.provider, config.model.name)
  return !!model?.features.includes('structured_output')
}

export const reconcileVisionConfig = (
  vision: VisionConfig,
  model: ModelCatalogItem,
): VisionConfig => {
  if (!model.features.includes('vision')) {
    return { enabled: false }
  }

  if (!vision.enabled) {
    return { enabled: false }
  }

  return {
    enabled: true,
    configs: {
      detail: vision.configs?.detail ?? 'high',
      variableSelector: vision.configs?.variableSelector?.length
        ? vision.configs.variableSelector
        : DEFAULT_VISION_SELECTOR,
    },
  }
}