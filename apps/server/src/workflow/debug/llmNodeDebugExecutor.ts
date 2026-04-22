import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { ChatOpenAI } from '@langchain/openai'
import { resolveGatewayChatModel } from '../../ai/gateway/resolveGatewayChatModel.js'
import {
  NodeRunStatus,
  type NodeDebugExecutor,
  type NodeDebugRequest,
  type NodeDebugResult,
  type RunError,
} from '../types.js'

const WORKFLOW_VARIABLE_PLACEHOLDER_RE = /\{\{#([\w-]+(?:\.[\w-]+)*)#\}\}/g
const DEFAULT_LLM_DEBUG_TIMEOUT_MS = 30_000
const VIRTUAL_MODEL_PROVIDER = 'virtual'
const VIRTUAL_MODEL_NAME = 'zhiling'

type ModelMode = 'chat' | 'completion'

type ChatPromptItem = {
  id: string
  role: 'system' | 'user' | 'assistant'
  text: string
}

type CompletionPromptItem = {
  text: string
}

type LLMNodeConfig = {
  model: {
    provider: string
    name: string
    mode: ModelMode
    completionParams: {
      temperature: number
      topP: number
      topK: number
      maxTokens: number
    }
  }
  promptTemplate: ChatPromptItem[] | CompletionPromptItem
  context: {
    enabled: boolean
    variableSelector: string[]
  }
  memory?: {
    queryPromptTemplate: string
  }
  structuredOutputEnabled: boolean
}

type LLMValidationIssue = {
  path: string
  message: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeChatPromptItem = (value: unknown): ChatPromptItem | null => {
  if (!isRecord(value)) {
    return null
  }

  return {
    id: typeof value.id === 'string' ? value.id : `prompt-${Date.now()}`,
    role: value.role === 'assistant' || value.role === 'user' ? value.role : 'system',
    text: typeof value.text === 'string' ? value.text : '',
  }
}

export const normalizeLLMNodeConfig = (value: unknown): LLMNodeConfig => {
  const defaults = {
    model: {
      provider: VIRTUAL_MODEL_PROVIDER,
      name: VIRTUAL_MODEL_NAME,
      mode: 'chat' as ModelMode,
      completionParams: {
        temperature: 0.7,
        topP: 1,
        topK: 1,
        maxTokens: 1024,
      },
    },
    promptTemplate: [{ id: 'prompt-1', role: 'system' as const, text: '' }],
    context: { enabled: false, variableSelector: [] },
    structuredOutputEnabled: false,
  }

  if (!isRecord(value)) {
    return defaults
  }

  const modelRecord = isRecord(value.model) ? value.model : {}
  const mode = modelRecord.mode === 'completion' ? 'completion' : 'chat'
  const completionParamsRecord = isRecord(modelRecord.completionParams)
    ? modelRecord.completionParams
    : isRecord(modelRecord.completion_params)
      ? modelRecord.completion_params
      : {}

  // Draft DSL uses snake_case (`prompt_template`); panel debug uses camelCase.
  const rawPromptTemplate = value.promptTemplate ?? value.prompt_template

  const promptTemplate = Array.isArray(rawPromptTemplate)
    ? rawPromptTemplate.map(normalizeChatPromptItem).filter(Boolean) as ChatPromptItem[]
    : isRecord(rawPromptTemplate)
      ? { text: typeof rawPromptTemplate.text === 'string' ? rawPromptTemplate.text : '' }
      : defaults.promptTemplate

  return {
    model: {
      provider: typeof modelRecord.provider === 'string' ? modelRecord.provider : defaults.model.provider,
      name: typeof modelRecord.name === 'string' ? modelRecord.name : defaults.model.name,
      mode,
      completionParams: {
        temperature: typeof completionParamsRecord.temperature === 'number'
          ? completionParamsRecord.temperature
          : defaults.model.completionParams.temperature,
        topP: typeof completionParamsRecord.topP === 'number'
          ? completionParamsRecord.topP
          : defaults.model.completionParams.topP,
        topK: typeof completionParamsRecord.topK === 'number'
          ? completionParamsRecord.topK
          : defaults.model.completionParams.topK,
        maxTokens: typeof completionParamsRecord.maxTokens === 'number'
          ? completionParamsRecord.maxTokens
          : defaults.model.completionParams.maxTokens,
      },
    },
    promptTemplate: mode === 'chat'
      ? (Array.isArray(promptTemplate) && promptTemplate.length
          ? promptTemplate
          : defaults.promptTemplate)
      : (!Array.isArray(promptTemplate) ? promptTemplate : { text: '' }),
    context: isRecord(value.context)
      ? {
          enabled: value.context.enabled === true,
          variableSelector: Array.isArray(value.context.variableSelector)
            ? value.context.variableSelector.filter((part): part is string => typeof part === 'string')
            : Array.isArray(value.context.variable_selector)
              ? value.context.variable_selector.filter((part): part is string => typeof part === 'string')
              : [],
        }
      : defaults.context,
    memory: isRecord(value.memory) && (
      typeof value.memory.queryPromptTemplate === 'string'
      || typeof value.memory.query_prompt_template === 'string'
    )
      ? {
          queryPromptTemplate: typeof value.memory.queryPromptTemplate === 'string'
            ? value.memory.queryPromptTemplate
            : String(value.memory.query_prompt_template),
        }
      : undefined,
    structuredOutputEnabled: value.structuredOutputEnabled === true
      || value.structured_output_enabled === true,
  }
}

const hasPromptContent = (config: LLMNodeConfig): boolean => {
  if (config.model.mode === 'chat') {
    return (config.promptTemplate as ChatPromptItem[]).some((item) => item.text.trim().length > 0)
  }

  return Boolean((config.promptTemplate as CompletionPromptItem).text.trim())
}

export const validateLLMNodeConfig = (config: LLMNodeConfig): LLMValidationIssue[] => {
  const issues: LLMValidationIssue[] = []

  if (!config.model.provider || !config.model.name) {
    issues.push({ path: 'model', message: '请选择模型' })
  }

  if (!config.memory && !hasPromptContent(config)) {
    issues.push({ path: 'promptTemplate', message: '提示词不能为空' })
  }

  if (config.memory && config.model.mode === 'chat' && !config.memory.queryPromptTemplate.includes('{{#sys.query#}}')) {
    issues.push({
      path: 'memory.queryPromptTemplate',
      message: '记忆 Query Prompt 必须包含 {{#sys.query#}}',
    })
  }

  return issues
}

const resolveVariablePath = (
  path: string,
  variables: Record<string, unknown>,
): unknown => {
  if (Object.prototype.hasOwnProperty.call(variables, path)) {
    return variables[path]
  }

  const segments = path.split('.')
  let current: unknown = variables

  for (const segment of segments) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined
    }

    current = current[segment]
  }

  return current
}

const stringifyVariableValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value === undefined || value === null) {
    return ''
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const interpolateWorkflowPrompt = (
  template: string,
  variables: Record<string, unknown>,
): string =>
  template.replace(WORKFLOW_VARIABLE_PLACEHOLDER_RE, (_match, selectorPath: string) => {
    const value = resolveVariablePath(selectorPath, variables)
    return stringifyVariableValue(value)
  })

const buildDebugVariables = (request: NodeDebugRequest): Record<string, unknown> => {
  return {
    ...(isRecord(request.context?.variables) ? request.context.variables : {}),
    ...(isRecord(request.inputs) ? request.inputs : {}),
  }
}

const normalizeMessageContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }

        if (isRecord(item) && typeof item.text === 'string') {
          return item.text
        }

        return ''
      })
      .join('')
  }

  return stringifyVariableValue(content)
}

const createLlmDebugModel = (config: LLMNodeConfig, nodeId: string) =>
  resolveGatewayChatModel(
    {
      userId: 'workflow-debug',
      intent: 'chat',
      traceId: `llm-debug-${nodeId}`,
    },
    {
      temperature: config.model.completionParams.temperature,
      topP: config.model.completionParams.topP,
      maxTokens: config.model.completionParams.maxTokens,
    },
  )

const buildChatMessages = (config: LLMNodeConfig, variables: Record<string, unknown>) => {
  const promptItems = config.promptTemplate as ChatPromptItem[]

  return promptItems.map((item) => {
    const content = interpolateWorkflowPrompt(item.text, variables)

    if (item.role === 'user') {
      return new HumanMessage(content)
    }

    return new SystemMessage(content)
  })
}

const invokeLlmWithTimeout = async (
  model: ChatOpenAI,
  messages: Array<SystemMessage | HumanMessage>,
  timeoutMs: number,
) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await model.invoke(messages, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const buildFailedResult = (
  request: NodeDebugRequest,
  startedAt: number,
  error: RunError,
): NodeDebugResult => {
  const finishedAt = Date.now()

  return {
    nodeId: request.node.id,
    status: NodeRunStatus.Failed,
    startedAt,
    finishedAt,
    elapsedMs: Math.max(0, finishedAt - startedAt),
    inputs: request.inputs,
    error,
  }
}

export const executeLlmNodeDebug: NodeDebugExecutor = async (request) => {
  const startedAt = Date.now()
  const config = normalizeLLMNodeConfig(request.node.inputs ?? request.node.data)
  const configIssues = validateLLMNodeConfig(config)

  if (configIssues.length > 0) {
    return buildFailedResult(request, startedAt, {
      code: 'llm_config_invalid',
      message: configIssues[0]?.message ?? 'LLM 节点配置无效',
      nodeId: request.node.id,
      details: { issues: configIssues },
    })
  }

  if (config.model.mode === 'completion') {
    return buildFailedResult(request, startedAt, {
      code: 'llm_mode_unsupported',
      message: '单节点调试暂不支持 Completion 模式',
      nodeId: request.node.id,
    })
  }

  const variables = buildDebugVariables(request)
  const timeoutMs = typeof request.inputs?.timeoutMs === 'number'
    ? request.inputs.timeoutMs
    : DEFAULT_LLM_DEBUG_TIMEOUT_MS

  try {
    const model = createLlmDebugModel(config, request.node.id)
    const messages = buildChatMessages(config, variables)
    const response = await invokeLlmWithTimeout(model, messages, timeoutMs)
    const text = normalizeMessageContent(response.content)
    const finishedAt = Date.now()

    return {
      nodeId: request.node.id,
      status: NodeRunStatus.Succeeded,
      startedAt,
      finishedAt,
      elapsedMs: Math.max(0, finishedAt - startedAt),
      inputs: {
        variables,
        model: {
          provider: config.model.provider,
          name: config.model.name,
          resolvedModel: model.model,
        },
        messages: messages.map((message) => ({
          role: message.getType(),
          content: typeof message.content === 'string' ? message.content : stringifyVariableValue(message.content),
        })),
      },
      outputs: {
        text,
        reasoning_content: '',
        usage: response.usage_metadata ?? {},
        ...(config.structuredOutputEnabled ? { structured_output: {} } : {}),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LLM 调试调用失败'
    const isTimeout = error instanceof Error && error.name === 'AbortError'

    return buildFailedResult(request, startedAt, {
      code: isTimeout ? 'llm_timeout' : 'llm_invoke_failed',
      message,
      nodeId: request.node.id,
    })
  }
}
