import { runKnowledgeRetrievalQuery } from '../../../rag/knowledgeFacade.js'
import type { KnowledgeRetrievalQuery } from '../../knowledge/knowledgeRetrievalService.js'
import {
  NodeRunStatus,
  type NodeDebugExecutor,
  type NodeDebugRequest,
  type NodeDebugResult,
  type RunError,
} from '../types/types.js'

type KnowledgeRetrievalMode = 'oneWay' | 'multiWay'

type KnowledgeRetrievalNodeConfig = {
  query_variable_selector: string[]
  query_attachment_selector: string[]
  dataset_ids: string[]
  retrieval_mode: KnowledgeRetrievalMode
  single_retrieval_config: {
    model: string
    top_k: number
    score_threshold: number | null
  }
  multiple_retrieval_config: {
    top_k: number
    score_threshold: number | null
    reranking_enable: boolean
    reranking_model: string
  }
}

type KnowledgeValidationIssue = {
  path: string
  message: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export const createDefaultKnowledgeRetrievalNodeConfig = (): KnowledgeRetrievalNodeConfig => ({
  query_variable_selector: ['sys', 'query'],
  query_attachment_selector: [],
  dataset_ids: [],
  retrieval_mode: 'multiWay',
  single_retrieval_config: {
    model: 'default-vector',
    top_k: 3,
    score_threshold: null,
  },
  multiple_retrieval_config: {
    top_k: 5,
    score_threshold: null,
    reranking_enable: false,
    reranking_model: 'default-rerank',
  },
})

export const normalizeKnowledgeRetrievalNodeConfig = (value: unknown): KnowledgeRetrievalNodeConfig => {
  const defaults = createDefaultKnowledgeRetrievalNodeConfig()

  if (!isRecord(value)) {
    return defaults
  }

  const singleConfig = isRecord(value.single_retrieval_config) ? value.single_retrieval_config : {}
  const multipleConfig = isRecord(value.multiple_retrieval_config) ? value.multiple_retrieval_config : {}

  return {
    query_variable_selector: toStringArray(value.query_variable_selector),
    query_attachment_selector: toStringArray(value.query_attachment_selector),
    dataset_ids: toStringArray(value.dataset_ids),
    retrieval_mode: value.retrieval_mode === 'oneWay' ? 'oneWay' : 'multiWay',
    single_retrieval_config: {
      model: typeof singleConfig.model === 'string' ? singleConfig.model : defaults.single_retrieval_config.model,
      top_k: typeof singleConfig.top_k === 'number' ? singleConfig.top_k : defaults.single_retrieval_config.top_k,
      score_threshold: toNumberOrNull(singleConfig.score_threshold),
    },
    multiple_retrieval_config: {
      top_k: typeof multipleConfig.top_k === 'number' ? multipleConfig.top_k : defaults.multiple_retrieval_config.top_k,
      score_threshold: toNumberOrNull(multipleConfig.score_threshold),
      reranking_enable: Boolean(multipleConfig.reranking_enable),
      reranking_model: typeof multipleConfig.reranking_model === 'string'
        ? multipleConfig.reranking_model
        : defaults.multiple_retrieval_config.reranking_model,
    },
  }
}

export const validateKnowledgeRetrievalNodeConfig = (
  config: KnowledgeRetrievalNodeConfig,
): KnowledgeValidationIssue[] => {
  const issues: KnowledgeValidationIssue[] = []

  if (!config.query_variable_selector.length) {
    issues.push({
      path: 'query_variable_selector',
      message: '请选择查询变量。',
    })
  }

  if (!config.dataset_ids.length) {
    issues.push({
      path: 'dataset_ids',
      message: '至少选择一个知识库。',
    })
  }

  if (config.retrieval_mode === 'oneWay' && !config.single_retrieval_config.model) {
    issues.push({
      path: 'single_retrieval_config.model',
      message: '单路召回模式下必须选择检索模型。',
    })
  }

  if (
    config.retrieval_mode === 'multiWay'
    && config.multiple_retrieval_config.reranking_enable
    && !config.multiple_retrieval_config.reranking_model
  ) {
    issues.push({
      path: 'multiple_retrieval_config.reranking_model',
      message: '开启 Rerank 后必须选择 Rerank 模型。',
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
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return ''
}

export const resolveKnowledgeDebugQuery = (
  config: KnowledgeRetrievalNodeConfig,
  request: NodeDebugRequest,
): string => {
  if (typeof request.inputs?.query === 'string' && request.inputs.query.trim()) {
    return request.inputs.query.trim()
  }

  const variables = {
    ...(isRecord(request.context?.variables) ? request.context.variables : {}),
    ...(isRecord(request.inputs) ? request.inputs : {}),
  }

  const selectorValue = resolveVariablePath(config.query_variable_selector.join('.'), variables)
  const resolved = stringifyVariableValue(selectorValue)

  return resolved
}

export const buildKnowledgeRetrievalQueryPayload = (
  config: KnowledgeRetrievalNodeConfig,
  query: string,
): KnowledgeRetrievalQuery => ({
  query,
  dataset_ids: config.dataset_ids,
  retrieval_mode: config.retrieval_mode,
  single_retrieval_config: config.single_retrieval_config,
  multiple_retrieval_config: config.multiple_retrieval_config,
  metadata_filtering_mode: 'disabled',
  metadata_filtering_conditions: [],
})

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

const filterDebugConfigIssues = (
  issues: KnowledgeValidationIssue[],
  request: NodeDebugRequest,
): KnowledgeValidationIssue[] => {
  const hasExplicitQuery = typeof request.inputs?.query === 'string' && request.inputs.query.trim().length > 0

  if (!hasExplicitQuery) {
    return issues
  }

  return issues.filter((issue) => issue.path !== 'query_variable_selector')
}

export const executeKnowledgeRetrievalNodeDebug: NodeDebugExecutor = async (request) => {
  const startedAt = Date.now()
  const config = normalizeKnowledgeRetrievalNodeConfig(request.node.inputs ?? request.node.data)
  const configIssues = filterDebugConfigIssues(
    validateKnowledgeRetrievalNodeConfig(config),
    request,
  )

  if (configIssues.length > 0) {
    return buildFailedResult(request, startedAt, {
      code: 'knowledge_config_invalid',
      message: configIssues[0]?.message ?? '知识检索节点配置无效',
      nodeId: request.node.id,
      details: { issues: configIssues },
    })
  }

  const query = resolveKnowledgeDebugQuery(config, request)
  if (!query) {
    return buildFailedResult(request, startedAt, {
      code: 'knowledge_query_missing',
      message: '知识检索调试缺少查询内容',
      nodeId: request.node.id,
    })
  }

  try {
    // 工作流「知识检索」节点：仅执行检索，输出 result/documents 供下游 LLM 的 context 变量消费
    const retrieval = await runKnowledgeRetrievalQuery(
      buildKnowledgeRetrievalQueryPayload(config, query),
    )
    const finishedAt = Date.now()

    return {
      nodeId: request.node.id,
      status: NodeRunStatus.Succeeded,
      startedAt,
      finishedAt,
      elapsedMs: Math.max(0, finishedAt - startedAt),
      inputs: {
        query,
        dataset_ids: config.dataset_ids,
        retrieval_mode: config.retrieval_mode,
      },
      outputs: {
        result: retrieval.items,
        documents: retrieval.items,
        files: [],
        diagnostics: retrieval.diagnostics,
        query: retrieval.query,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '知识检索调试失败'

    return buildFailedResult(request, startedAt, {
      code: error instanceof Error && error.message === 'KNOWLEDGE_DATASET_NOT_FOUND'
        ? 'knowledge_dataset_not_found'
        : 'knowledge_retrieval_failed',
      message,
      nodeId: request.node.id,
    })
  }
}
