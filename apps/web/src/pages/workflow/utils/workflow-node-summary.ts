import { getModelCatalogItem } from '../features/llm-panel/catalog'
import { normalizeLLMNodeConfig } from '../features/llm-panel/schema'
import { normalizeStartNodeConfig, getStartVariableTypeLabel } from '../features/start-panel/schema'
import {
  getKnowledgeSelectedDatasets,
  normalizeKnowledgeRetrievalNodeConfig,
} from '../features/knowledge-retrieval-panel/schema'
import { normalizeEndNodeConfig } from '../features/end-panel/schema'
import type { CanvasNodeData } from '../types/canvas'
import { serializeValueSelector } from './variable-options'

export type WorkflowNodeSummaryTone = 'slate' | 'blue' | 'amber'

export type WorkflowNodeSummaryTag = {
  text: string
  tone?: WorkflowNodeSummaryTone
}

export type WorkflowNodeSummaryItem = {
  primary: string
  secondary?: string
  meta?: string
  tone?: WorkflowNodeSummaryTone
}

export type WorkflowNodeSummary = {
  tags: WorkflowNodeSummaryTag[]
  items: WorkflowNodeSummaryItem[]
}

const truncateText = (value: string, maxLength = 40) => {
  if (value.length <= maxLength)
    return value

  return `${value.slice(0, maxLength - 1)}...`
}

const buildStartSummary = (data: CanvasNodeData): WorkflowNodeSummary => {
  const config = normalizeStartNodeConfig(data.inputs)
  const variables = config.variables.filter(variable => variable.variable.trim() || variable.label.trim())

  if (!variables.length) {
    return {
      tags: [{ text: '系统输入', tone: 'slate' }],
      items: [{ primary: 'query / files', secondary: '使用系统注入的默认输入' }],
    }
  }

  const requiredCount = variables.filter(variable => variable.required).length
  const items: WorkflowNodeSummaryItem[] = variables.slice(0, 2).map(variable => ({
    primary: variable.label.trim() || variable.variable.trim() || '未命名输入',
    secondary: getStartVariableTypeLabel(variable.type),
    meta: variable.required ? '必填' : undefined,
    tone: variable.required ? 'amber' : 'slate',
  }))

  if (variables.length > 2) {
    items.push({
      primary: `+${variables.length - 2} 个更多输入`,
      tone: 'slate',
    })
  }

  return {
    tags: [
      { text: `${variables.length} 个输入`, tone: 'blue' },
      ...(requiredCount ? [{ text: `${requiredCount} 个必填`, tone: 'amber' as WorkflowNodeSummaryTone }] : []),
    ],
    items,
  }
}

const buildLlmSummary = (data: CanvasNodeData): WorkflowNodeSummary => {
  const config = normalizeLLMNodeConfig(data.inputs)
  const modelLabel = getModelCatalogItem(config.model.provider, config.model.name)?.label
    ?? `${config.model.provider}/${config.model.name}`

  const promptText = config.model.mode === 'chat'
    ? (Array.isArray(config.promptTemplate)
        ? config.promptTemplate.find(item => item.text.trim())?.text.trim() ?? ''
        : '')
    : (!Array.isArray(config.promptTemplate)
        ? config.promptTemplate.text.trim()
        : '')

  const featureParts = [
    config.context.enabled
      ? `上下文 ${config.context.variableSelector.length ? serializeValueSelector(config.context.variableSelector) : '已启用'}`
      : '',
    config.memory
      ? `记忆${config.memory.window.enabled ? ` ${config.memory.window.size ?? 50} 轮` : ''}`
      : '',
    config.vision.enabled ? '视觉' : '',
    config.structuredOutputEnabled
      ? `结构化 ${Object.keys(config.structuredOutput?.schema.properties ?? {}).length} 字段`
      : '',
  ].filter(Boolean)

  return {
    tags: [
      { text: modelLabel, tone: 'blue' },
      { text: config.model.mode === 'chat' ? 'CHAT' : 'COMPLETION', tone: 'slate' },
    ],
    items: [
      {
        primary: promptText ? truncateText(promptText, 34) : '未设置 Prompt',
        secondary: promptText ? '当前节点 Prompt 摘要' : '打开配置面板补充 Prompt 内容',
      },
      ...(featureParts.length
        ? [{ primary: truncateText(featureParts.join(' · '), 48), tone: 'slate' as WorkflowNodeSummaryTone }]
        : []),
    ],
  }
}

const buildKnowledgeSummary = (data: CanvasNodeData): WorkflowNodeSummary => {
  const config = normalizeKnowledgeRetrievalNodeConfig(data.inputs)
  const datasets = data._datasets?.length ? data._datasets : getKnowledgeSelectedDatasets(config.dataset_ids)
  const selectedDatasetLabel = datasets.length
    ? datasets.slice(0, 2).map(dataset => dataset.name).join('、')
    : '未选择知识库'
  const hasMoreDatasets = datasets.length > 2

  return {
    tags: [
      { text: config.retrieval_mode === 'oneWay' ? '单路召回' : '多路召回', tone: 'blue' },
      { text: `${datasets.length} 个知识库`, tone: 'slate' },
    ],
    items: [
      {
        primary: `查询: ${config.query_variable_selector.length ? serializeValueSelector(config.query_variable_selector) : '未设置'}`,
      },
      {
        primary: truncateText(selectedDatasetLabel, 34),
        secondary: hasMoreDatasets ? `另有 ${datasets.length - 2} 个知识库` : undefined,
      },
      ...(config.metadata_filtering_mode === 'manual' && config.metadata_filtering_conditions.length
        ? [{
            primary: `Metadata 过滤 ${config.metadata_filtering_conditions.length} 条`,
            tone: 'amber' as WorkflowNodeSummaryTone,
          }]
        : []),
    ],
  }
}

const getConstantTypeLabel = (constantType: string) => {
  if (constantType === 'json')
    return 'JSON'

  if (constantType === 'boolean')
    return 'Boolean'

  if (constantType === 'number')
    return 'Number'

  return 'String'
}

const buildEndSummary = (data: CanvasNodeData): WorkflowNodeSummary => {
  const config = normalizeEndNodeConfig(data.inputs, data.outputs)
  const outputs = config.outputs.filter(output => output.variable.trim())

  if (!outputs.length) {
    return {
      tags: [{ text: '未配置输出', tone: 'amber' }],
      items: [{ primary: '打开配置面板设置返回字段' }],
    }
  }

  const items: WorkflowNodeSummaryItem[] = outputs.slice(0, 2).map(output => ({
    primary: output.variable.trim(),
    secondary: output.variable_type === 'variable'
      ? `引用 ${serializeValueSelector(output.value_selector) || '未绑定变量'}`
      : `${getConstantTypeLabel(output.constant_type)} 常量`,
    meta: output.variable_type === 'variable' ? '变量' : '常量',
  }))

  if (outputs.length > 2) {
    items.push({
      primary: `+${outputs.length - 2} 个更多输出`,
      tone: 'slate',
    })
  }

  return {
    tags: [{ text: `${outputs.length} 个输出字段`, tone: 'blue' }],
    items,
  }
}

export const buildWorkflowNodeSummary = (data: CanvasNodeData): WorkflowNodeSummary => {
  switch (data.kind) {
    case 'trigger':
      return buildStartSummary(data)
    case 'llm':
      return buildLlmSummary(data)
    case 'knowledge':
      return buildKnowledgeSummary(data)
    case 'end':
      return buildEndSummary(data)
    default:
      return {
        tags: [],
        items: [],
      }
  }
}