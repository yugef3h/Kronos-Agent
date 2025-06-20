export type ValueSelector = string[]

export type PromptRole = 'system' | 'user' | 'assistant'
export type ModelMode = 'chat' | 'completion'
export type VisionDetail = 'high' | 'low' | 'auto'
export type ReasoningFormat = 'tagged' | 'separated'
export type ModelFeature = 'vision' | 'structured_output' | 'reasoning'
export type CompletionParamKey = 'temperature' | 'maxTokens' | 'topP' | 'topK'

export type ChatPromptItem = {
  id: string
  role: PromptRole
  text: string
}

export type CompletionPromptItem = {
  text: string
}

export type MemoryConfig = {
  rolePrefix?: {
    user: string
    assistant: string
  }
  window: {
    enabled: boolean
    size: number | null
  }
  queryPromptTemplate: string
}

export type VisionConfig = {
  enabled: boolean
  configs?: {
    detail: VisionDetail
    variableSelector: ValueSelector
  }
}

export type StructuredField = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  properties?: Record<string, StructuredField>
  required?: string[]
  items?: StructuredField
  enum?: Array<string | number>
  additionalProperties?: false
}

export type StructuredOutputConfig = {
  schema: {
    type: 'object'
    properties: Record<string, StructuredField>
    required?: string[]
    additionalProperties: false
  }
}

export type ModelConfig = {
  provider: string
  name: string
  mode: ModelMode
  completionParams: Record<string, unknown>
}

export type LLMNodeConfig = {
  model: ModelConfig
  promptTemplate: ChatPromptItem[] | CompletionPromptItem
  memory?: MemoryConfig
  context: {
    enabled: boolean
    variableSelector: ValueSelector
  }
  vision: VisionConfig
  structuredOutputEnabled?: boolean
  structuredOutput?: StructuredOutputConfig
  reasoningFormat?: ReasoningFormat
}

export type ModelCatalogItem = {
  provider: string
  name: string
  label: string
  mode: ModelMode
  features: ModelFeature[]
  supportedCompletionParams: CompletionParamKey[]
}

export type CompletionParamDefinition = {
  key: CompletionParamKey
  label: string
  description: string
  min: number
  max: number
  step: number
  defaultValue: number
  inputMin?: number
  inputMax?: number
}

export type VariableOption = {
  label: string
  valueSelector: ValueSelector
  valueType: 'string' | 'file' | 'object' | 'array' | 'number' | 'boolean'
  source: 'system' | 'node'
}

export type ValidationIssue = {
  path: string
  message: string
}