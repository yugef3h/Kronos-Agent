import type { Node } from 'reactflow'
import type {
  LegacyWorkflowDSL,
  LegacyWorkflowEdge,
  LegacyWorkflowNode,
  WorkflowDSL,
  WorkflowGraphEdge,
  WorkflowGraphNode,
  WorkflowGraphNodeSemanticType,
} from '../../../features/workflow/workflowAppStore'
import type { Edge } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import {
  buildIfElseTargetBranches,
  createDefaultIfElseNodeConfig,
  normalizeIfElseNodeConfig,
} from '../features/ifelse-panel/schema'
import {
  buildIterationChildren,
  createDefaultIterationNodeConfig,
  normalizeIterationNodeConfig,
} from '../features/iteration-panel/schema'
import { buildLLMNodeOutputs, buildLLMOutputTypes, normalizeLLMNodeConfig } from '../features/llm-panel/schema'
import {
  createDefaultKnowledgeRetrievalNodeConfig,
  normalizeKnowledgeRetrievalNodeConfig,
} from '../features/knowledge-retrieval-panel/schema'
import { getKnowledgeDatasetsByIds } from '../features/knowledge-retrieval-panel/dataset-store'
import {
  buildLoopChildren,
  createDefaultLoopNodeConfig,
  normalizeLoopNodeConfig,
} from '../features/loop-panel/schema'
import {
  buildEndNodeOutputs,
  normalizeEndNodeConfig,
} from '../features/end-panel/schema'
import {
  buildStartNodeOutputs,
  buildStartOutputTypes,
  normalizeStartNodeConfig,
} from '../features/start-panel/schema'

type AnyWorkflowDSL = WorkflowDSL | LegacyWorkflowDSL

type LegacyOrDifyNode = WorkflowGraphNode | LegacyWorkflowNode
type LegacyOrDifyEdge = WorkflowGraphEdge | LegacyWorkflowEdge

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isLegacyWorkflowDsl = (dsl: AnyWorkflowDSL): dsl is LegacyWorkflowDSL => {
  return Array.isArray((dsl as LegacyWorkflowDSL).nodes) && Array.isArray((dsl as LegacyWorkflowDSL).edges)
}

const isLegacyWorkflowNode = (node: LegacyOrDifyNode): node is LegacyWorkflowNode => {
  return isRecord(node.data) && ('kind' in node.data || 'label' in node.data || node.type !== 'custom')
}

const isDifyWorkflowNode = (node: LegacyOrDifyNode): node is WorkflowGraphNode => {
  return isRecord(node.data) && typeof (node.data as Record<string, unknown>).type === 'string'
}

const toSerializableValue = (value: unknown) => {
  if (typeof value === 'string')
    return value

  if (typeof value === 'number' || typeof value === 'boolean' || value === null)
    return String(value)

  try {
    return JSON.stringify(value ?? '')
  } catch {
    return ''
  }
}

const normalizeEdgeSourceHandle = (handle?: string | null) => {
  return handle === 'source' ? 'out' : handle ?? undefined
}

const normalizeEdgeTargetHandle = (handle?: string | null) => {
  return handle === 'target' ? 'in' : handle ?? undefined
}

const serializeEdgeSourceHandle = (handle?: string | null) => {
  if (!handle || handle === 'out')
    return 'source'

  return handle
}

const serializeEdgeTargetHandle = (handle?: string | null) => {
  if (!handle || handle === 'in')
    return 'target'

  return handle
}

const getWorkflowGraph = (dsl: AnyWorkflowDSL) => {
  if (isLegacyWorkflowDsl(dsl)) {
    return {
      nodes: dsl.nodes,
      edges: dsl.edges,
    }
  }

  return dsl.workflow.graph
}

export const getWorkflowDslNodes = (dsl: AnyWorkflowDSL): LegacyOrDifyNode[] => {
  return getWorkflowGraph(dsl).nodes
}

export const getWorkflowDslEdges = (dsl: AnyWorkflowDSL): LegacyOrDifyEdge[] => {
  return getWorkflowGraph(dsl).edges
}

export const hydrateCanvasEdgesFromDsl = (dsl: AnyWorkflowDSL): Edge[] => {
  return getWorkflowDslEdges(dsl).map((edge) => ({
    ...edge,
    type: 'custom',
    sourceHandle: normalizeEdgeSourceHandle(edge.sourceHandle),
    targetHandle: normalizeEdgeTargetHandle(edge.targetHandle),
  })) as Edge[]
}

const semanticTypeByKind: Record<CanvasNodeData['kind'], WorkflowGraphNodeSemanticType> = {
  trigger: 'start',
  llm: 'llm',
  knowledge: 'knowledge-retrieval',
  end: 'end',
  condition: 'if-else',
  iteration: 'iteration',
  'iteration-start': 'iteration-start',
  'iteration-end': 'iteration-end',
  loop: 'loop',
  'loop-start': 'loop-start',
  'loop-end': 'loop-end',
}

const kindBySemanticType: Partial<Record<WorkflowGraphNodeSemanticType, CanvasNodeData['kind']>> = {
  start: 'trigger',
  llm: 'llm',
  'knowledge-retrieval': 'knowledge',
  end: 'end',
  'if-else': 'condition',
  iteration: 'iteration',
  'iteration-start': 'iteration-start',
  'iteration-end': 'iteration-end',
  loop: 'loop',
  'loop-start': 'loop-start',
  'loop-end': 'loop-end',
}

const getNodeTitleFallback = (kind: CanvasNodeData['kind']) => {
  switch (kind) {
    case 'trigger':
      return '用户输入'
    case 'knowledge':
      return '知识检索'
    case 'llm':
      return 'LLM'
    case 'end':
      return '输出'
    case 'condition':
      return '条件分支'
    case 'iteration':
      return 'Iteration'
    case 'iteration-start':
      return '开始'
    case 'iteration-end':
      return '结束'
    case 'loop':
      return 'Loop'
    case 'loop-start':
      return '开始'
    case 'loop-end':
      return '结束'
    default:
      return '未命名节点'
  }
}

const getNodeSubtitleFallback = (kind: CanvasNodeData['kind']) => {
  switch (kind) {
    case 'trigger':
      return '开始'
    case 'knowledge':
      return 'knowledge'
    case 'llm':
      return 'llm'
    case 'end':
      return 'end'
    case 'condition':
      return 'condition'
    case 'iteration':
      return 'iteration'
    case 'iteration-start':
      return '开始'
    case 'iteration-end':
      return '结束'
    case 'loop':
      return 'loop'
    case 'loop-start':
      return '开始'
    case 'loop-end':
      return '结束'
    default:
      return ''
  }
}

const getDifyNodeDimensions = (kind: CanvasNodeData['kind']) => {
  switch (kind) {
    case 'trigger':
      return { width: 242, height: 109 }
    case 'knowledge':
      return { width: 242, height: 90 }
    default:
      return { width: 242, height: 88 }
  }
}

const resolveCanvasKindFromNode = (node: LegacyOrDifyNode): CanvasNodeData['kind'] | null => {
  if (isLegacyWorkflowNode(node) && typeof node.data.kind === 'string') {
    return isCanvasNodeKind(node.data.kind) ? node.data.kind : null
  }

  if (isDifyWorkflowNode(node)) {
    return kindBySemanticType[node.data.type as WorkflowGraphNodeSemanticType] ?? null
  }

  if (typeof node.type === 'string' && isCanvasNodeKind(node.type)) {
    return node.type
  }

  return null
}

const normalizeEndOutputType = (value: unknown) => {
  return ['string', 'number', 'boolean', 'object', 'array', 'file'].includes(String(value))
    ? String(value)
    : 'string'
}

const buildEndOutputTypesFromConfig = (inputs: Record<string, unknown> | undefined, outputs: Record<string, unknown> | undefined) => {
  const config = normalizeEndNodeConfig(inputs, outputs)
  const explicitOutputTypes = (inputs as { _outputTypes?: Record<string, unknown> } | undefined)?._outputTypes

  return config.outputs.reduce<Record<string, string>>((acc, output) => {
    const key = output.variable.trim()
    if (!key)
      return acc

    const explicitType = explicitOutputTypes?.[key]
    if (typeof explicitType === 'string' && explicitType) {
      acc[key] = normalizeEndOutputType(explicitType)
      return acc
    }

    if (output.variable_type === 'constant') {
      acc[key] = output.constant_type === 'json' ? 'object' : output.constant_type
      return acc
    }

    const sampleValue = outputs?.[key]
    if (typeof sampleValue === 'number')
      acc[key] = 'number'
    else if (typeof sampleValue === 'boolean')
      acc[key] = 'boolean'
    else if (Array.isArray(sampleValue))
      acc[key] = 'array'
    else if (sampleValue && typeof sampleValue === 'object')
      acc[key] = 'object'
    else
      acc[key] = 'string'

    return acc
  }, {})
}

const serializeLLMInputs = (inputs: Record<string, unknown> | undefined) => {
  const config = normalizeLLMNodeConfig(inputs)

  return {
    model: {
      provider: config.model.provider,
      name: config.model.name,
      mode: config.model.mode,
      completion_params: {
        ...config.model.completionParams,
      },
    },
    prompt_template: Array.isArray(config.promptTemplate)
      ? config.promptTemplate.map(item => ({
          id: item.id,
          role: item.role,
          text: item.text,
        }))
      : {
          text: config.promptTemplate.text,
        },
    ...(config.memory
      ? {
          memory: {
            ...(config.memory.rolePrefix
              ? {
                  role_prefix: {
                    user: config.memory.rolePrefix.user,
                    assistant: config.memory.rolePrefix.assistant,
                  },
                }
              : {}),
            window: config.memory.window,
            query_prompt_template: config.memory.queryPromptTemplate,
          },
        }
      : {}),
    context: {
      enabled: config.context.enabled,
      variable_selector: config.context.variableSelector,
    },
    vision: {
      enabled: config.vision.enabled,
      ...(config.vision.configs
        ? {
            configs: {
              detail: config.vision.configs.detail,
              variable_selector: config.vision.configs.variableSelector,
            },
          }
        : {}),
    },
    structured_output_enabled: Boolean(config.structuredOutputEnabled),
    ...(config.structuredOutput
      ? {
          structured_output: config.structuredOutput,
        }
      : {}),
    reasoning_format: config.reasoningFormat,
  }
}

const deserializeLLMInputs = (data: Record<string, unknown>) => {
  const rawModel = isRecord(data.model) ? data.model : {}
  const rawContext = isRecord(data.context) ? data.context : {}
  const rawMemory = isRecord(data.memory) ? data.memory : {}
  const rawVision = isRecord(data.vision) ? data.vision : {}
  const rawVisionConfigs = isRecord(rawVision.configs) ? rawVision.configs : {}

  const normalizedConfig = normalizeLLMNodeConfig({
    model: {
      provider: rawModel.provider,
      name: rawModel.name,
      mode: rawModel.mode,
      completionParams: isRecord(rawModel.completion_params)
        ? rawModel.completion_params
        : rawModel.completionParams,
    },
    promptTemplate: data.prompt_template ?? data.promptTemplate,
    memory: {
      ...(isRecord(rawMemory.role_prefix)
        ? {
            rolePrefix: {
              user: rawMemory.role_prefix.user,
              assistant: rawMemory.role_prefix.assistant,
            },
          }
        : {}),
      window: rawMemory.window,
      queryPromptTemplate: rawMemory.query_prompt_template ?? rawMemory.queryPromptTemplate,
    },
    context: {
      enabled: rawContext.enabled,
      variableSelector: rawContext.variable_selector ?? rawContext.variableSelector,
    },
    vision: {
      enabled: rawVision.enabled,
      configs: {
        detail: rawVisionConfigs.detail,
        variableSelector: rawVisionConfigs.variable_selector ?? rawVisionConfigs.variableSelector,
      },
    },
    structuredOutputEnabled: data.structured_output_enabled ?? data.structuredOutputEnabled,
    structuredOutput: data.structured_output ?? data.structuredOutput,
    reasoningFormat: data.reasoning_format ?? data.reasoningFormat,
  })

  return {
    ...normalizedConfig,
    _outputTypes: buildLLMOutputTypes(normalizedConfig),
  } as Record<string, unknown>
}

const serializeKnowledgeInputs = (inputs: Record<string, unknown> | undefined) => {
  const config = normalizeKnowledgeRetrievalNodeConfig(inputs)

  // 两次对话最终确认的 Dify YAML 约束:
  // 1. `retrieval_mode: multiple` 时，导出最小安全格式，直接省略 `single_retrieval_config`
  // 2. `multiple_retrieval_config.reranking_model` 不能再是字符串；未启用 rerank 时直接不写
  // 3. `retrieval_mode: single` 时，`single_retrieval_config.model` 必须是对象 `{ provider, model }`
  // 4. 典型安全片段:
  //    retrieval_mode: multiple
  //    multiple_retrieval_config:
  //      top_k: 5
  //      score_threshold: null
  //      reranking_enable: false
  //      reranking_mode: reranking_model
  if (config.retrieval_mode === 'oneWay') {
    return {
      query_variable_selector: config.query_variable_selector,
      query_attachment_selector: config.query_attachment_selector,
      dataset_ids: config.dataset_ids,
      retrieval_mode: 'single',
      ...(config.single_retrieval_config.model
        ? {
            single_retrieval_config: {
              model: config.single_retrieval_config.model,
            },
          }
        : {}),
    }
  }

  return {
    query_variable_selector: config.query_variable_selector,
    query_attachment_selector: config.query_attachment_selector,
    dataset_ids: config.dataset_ids,
    retrieval_mode: 'multiple',
    multiple_retrieval_config: {
      top_k: config.multiple_retrieval_config.top_k,
      score_threshold: config.multiple_retrieval_config.score_threshold,
      reranking_enable: config.multiple_retrieval_config.reranking_enable,
      reranking_mode: config.multiple_retrieval_config.reranking_mode ?? 'reranking_model',
      ...(config.multiple_retrieval_config.reranking_enable
        && config.multiple_retrieval_config.reranking_model
        ? {
            reranking_model: config.multiple_retrieval_config.reranking_model,
          }
        : {}),
    },
  }
}

const deserializeKnowledgeInputs = (data: Record<string, unknown>) => {
  const normalizedConfig = normalizeKnowledgeRetrievalNodeConfig({
    query_variable_selector: Array.isArray(data.query_variable_selector) ? data.query_variable_selector : [],
    query_attachment_selector: Array.isArray(data.query_attachment_selector) ? data.query_attachment_selector : [],
    dataset_ids: Array.isArray(data.dataset_ids) ? data.dataset_ids : [],
    retrieval_mode: data.retrieval_mode === 'single' || data.retrieval_mode === 'oneWay' ? 'oneWay' : 'multiWay',
    single_retrieval_config: data.single_retrieval_config,
    multiple_retrieval_config: data.multiple_retrieval_config,
  })

  return normalizedConfig as Record<string, unknown>
}

const serializeEndInputs = (
  inputs: Record<string, unknown> | undefined,
  outputs: Record<string, unknown> | undefined,
) => {
  const config = normalizeEndNodeConfig(inputs, outputs)
  const outputTypes = buildEndOutputTypesFromConfig(inputs, outputs)

  return {
    outputs: config.outputs.map(output => ({
      variable: output.variable,
      value_selector: output.value_selector,
      value: output.value,
      value_type: outputTypes[output.variable] ?? 'string',
    })),
  }
}

const deserializeEndInputs = (data: Record<string, unknown>) => {
  const rawOutputs = Array.isArray(data.outputs) ? data.outputs : []
  const normalizedOutputs = rawOutputs.map((item) => {
    const record = isRecord(item) ? item : {}
    const valueType = normalizeEndOutputType(record.value_type)
    const valueSelector = Array.isArray(record.value_selector)
      ? record.value_selector.filter((part): part is string => typeof part === 'string')
      : []

    return {
      id: typeof record.id === 'string' && record.id ? record.id : undefined,
      variable: typeof record.variable === 'string' ? record.variable : '',
      value_selector: valueSelector,
      variable_type: valueSelector.length ? 'variable' : 'constant',
      value: toSerializableValue(record.value ?? ''),
      constant_type: valueType === 'object' ? 'json' : valueType === 'array' || valueType === 'file' ? 'string' : valueType,
    }
  })

  const outputTypes = normalizedOutputs.reduce<Record<string, string>>((acc, output) => {
    const key = output.variable.trim()
    if (key) {
      acc[key] = rawOutputs.find((item) => isRecord(item) && item.variable === key && typeof item.value_type === 'string')?.value_type as string ?? 'string'
    }
    return acc
  }, {})

  return {
    outputs: normalizedOutputs,
    _outputTypes: outputTypes,
  } as Record<string, unknown>
}

const serializeConditionInputs = (inputs: Record<string, unknown> | undefined) => {
  const config = normalizeIfElseNodeConfig(inputs)

  return {
    cases: config.cases.map(caseItem => ({
      case_id: caseItem.case_id,
      logical_operator: caseItem.logical_operator,
      conditions: caseItem.conditions.map(condition => ({
        id: condition.id,
        variable_selector: condition.variableSelector,
        variable_type: condition.variableType,
        comparison_operator: condition.comparisonOperator,
        value: condition.value,
      })),
    })),
  }
}

const deserializeConditionInputs = (data: Record<string, unknown>) => {
  return {
    cases: Array.isArray(data.cases)
      ? data.cases.map((caseItem) => {
          const record = isRecord(caseItem) ? caseItem : {}

          return {
            case_id: record.case_id,
            logical_operator: record.logical_operator,
            conditions: Array.isArray(record.conditions)
              ? record.conditions.map((condition) => {
                  const conditionRecord = isRecord(condition) ? condition : {}
                  return {
                    id: conditionRecord.id,
                    variableSelector: conditionRecord.variable_selector ?? conditionRecord.variableSelector,
                    variableType: conditionRecord.variable_type ?? conditionRecord.variableType,
                    comparisonOperator: conditionRecord.comparison_operator ?? conditionRecord.comparisonOperator,
                    value: conditionRecord.value,
                  }
                })
              : [],
          }
        })
      : [],
  } as Record<string, unknown>
}

const serializeLoopInputs = (inputs: Record<string, unknown> | undefined, nodeId?: string) => {
  const config = normalizeLoopNodeConfig(inputs, nodeId)

  return {
    start_node_id: config.start_node_id,
    loop_variables: config.loop_variables,
    break_conditions: config.break_conditions.map(condition => ({
      id: condition.id,
      variable_selector: condition.variableSelector,
      variable_type: condition.variableType,
      comparison_operator: condition.comparisonOperator,
      value: condition.value,
    })),
    logical_operator: config.logical_operator,
    loop_count: config.loop_count,
  }
}

const deserializeLoopInputs = (data: Record<string, unknown>, nodeId?: string) => {
  const rawBreakConditions = Array.isArray(data.break_conditions) ? data.break_conditions : []

  return normalizeLoopNodeConfig({
    start_node_id: data.start_node_id,
    loop_variables: data.loop_variables,
    break_conditions: rawBreakConditions.map((condition) => {
      const record = isRecord(condition) ? condition : {}
      return {
        id: record.id,
        variableSelector: record.variable_selector ?? record.variableSelector,
        variableType: record.variable_type ?? record.variableType,
        comparisonOperator: record.comparison_operator ?? record.comparisonOperator,
        value: record.value,
      }
    }),
    logical_operator: data.logical_operator,
    loop_count: data.loop_count,
  }, nodeId) as unknown as Record<string, unknown>
}

const serializeIterationInputs = (inputs: Record<string, unknown> | undefined, nodeId?: string) => {
  const config = normalizeIterationNodeConfig(inputs, nodeId)

  return {
    start_node_id: config.start_node_id,
    iterator_selector: config.iterator_selector,
    output_selector: config.output_selector,
    output_type: config.output_type,
    is_parallel: config.is_parallel,
    parallel_nums: config.parallel_nums,
    error_handle_mode: config.error_handle_mode,
    flatten_output: config.flatten_output,
  }
}

const deserializeIterationInputs = (data: Record<string, unknown>, nodeId?: string) => {
  return normalizeIterationNodeConfig({
    start_node_id: data.start_node_id,
    iterator_selector: data.iterator_selector,
    output_selector: data.output_selector,
    output_type: data.output_type,
    is_parallel: data.is_parallel,
    parallel_nums: data.parallel_nums,
    error_handle_mode: data.error_handle_mode,
    flatten_output: data.flatten_output,
  }, nodeId) as unknown as Record<string, unknown>
}

const serializeNodeInputs = (
  kind: CanvasNodeData['kind'],
  inputs: Record<string, unknown> | undefined,
  outputs: Record<string, unknown> | undefined,
  nodeId?: string,
) => {
  switch (kind) {
    case 'trigger':
      return {
        variables: normalizeStartNodeConfig(inputs).variables,
      }
    case 'llm':
      return serializeLLMInputs(inputs)
    case 'knowledge':
      return serializeKnowledgeInputs(inputs)
    case 'end':
      return serializeEndInputs(inputs, outputs)
    case 'condition':
      return serializeConditionInputs(inputs)
    case 'iteration':
      return serializeIterationInputs(inputs, nodeId)
    case 'loop':
      return serializeLoopInputs(inputs, nodeId)
    case 'iteration-start':
    case 'iteration-end':
    case 'loop-start':
    case 'loop-end':
      return {}
    default:
      return {}
  }
}

const deserializeNodeInputs = (
  kind: CanvasNodeData['kind'],
  data: Record<string, unknown>,
  nodeId?: string,
) => {
  switch (kind) {
    case 'trigger': {
      const normalizedConfig = normalizeStartNodeConfig({
        variables: data.variables,
      })

      return {
        ...normalizedConfig,
        _outputTypes: buildStartOutputTypes(normalizedConfig),
      } as Record<string, unknown>
    }
    case 'llm':
      return deserializeLLMInputs(data)
    case 'knowledge':
      return deserializeKnowledgeInputs(data)
    case 'end':
      return deserializeEndInputs(data)
    case 'condition':
      return deserializeConditionInputs(data)
    case 'iteration':
      return deserializeIterationInputs(data, nodeId)
    case 'loop':
      return deserializeLoopInputs(data, nodeId)
    case 'iteration-start':
    case 'iteration-end':
    case 'loop-start':
    case 'loop-end':
      return getDefaultInputs(kind, nodeId)
    default:
      return undefined
  }
}

const getDefaultOutputs = (kind: CanvasNodeData['kind'], inputs?: Record<string, unknown>): Record<string, unknown> | undefined => {
  switch (kind) {
    case 'trigger':
      return buildStartNodeOutputs(normalizeStartNodeConfig(inputs))
    case 'llm':
      return buildLLMNodeOutputs(normalizeLLMNodeConfig(inputs))
    case 'knowledge':
      return {
        result: [],
        documents: [],
        files: [],
      }
    case 'condition':
      return {
        matched: false,
      }
    case 'iteration':
      return {
        items: [],
        count: 0,
      }
    case 'loop':
      return {
        steps: [],
        count: 0,
      }
    case 'iteration-start':
      return {
        item: {},
        index: 0,
      }
    case 'loop-start':
      return {
        index: 0,
      }
    case 'iteration-end':
      return {
        item: null,
        done: true,
      }
    case 'loop-end':
      return {
        done: true,
      }
    case 'end':
      return buildEndNodeOutputs(normalizeEndNodeConfig(inputs))
    default:
      return undefined
  }
}

const getDefaultInputs = (kind: CanvasNodeData['kind'], nodeId?: string): Record<string, unknown> | undefined => {
  switch (kind) {
    case 'condition':
      return createDefaultIfElseNodeConfig() as unknown as Record<string, unknown>
    case 'knowledge':
      return createDefaultKnowledgeRetrievalNodeConfig() as unknown as Record<string, unknown>
    case 'iteration':
      return createDefaultIterationNodeConfig(nodeId) as unknown as Record<string, unknown>
    case 'loop':
      return createDefaultLoopNodeConfig(nodeId) as unknown as Record<string, unknown>
    case 'iteration-start':
      return {
        _outputTypes: {
          item: 'object',
          index: 'number',
        },
      }
    case 'loop-start':
      return {
        _outputTypes: {
          index: 'number',
        },
      }
    case 'iteration-end':
      return {
        _outputTypes: {
          item: 'object',
          done: 'boolean',
        },
      }
    case 'loop-end':
      return {
        _outputTypes: {
          done: 'boolean',
        },
      }
    default:
      return undefined
  }
}

const isCanvasNodeKind = (kind: unknown): kind is CanvasNodeData['kind'] => {
  return ['llm', 'knowledge', 'end', 'condition', 'iteration', 'loop', 'trigger', 'iteration-start', 'iteration-end', 'loop-start', 'loop-end'].includes(
    String(kind),
  )
}

export const createInitialTriggerNode = (): Node<CanvasNodeData> => ({
  id: 'trigger-1',
  type: 'workflow',
  dragHandle: '.workflow-node-drag-surface',
  position: { x: 80, y: 282 },
  data: buildCanvasNodeData({
    nodeId: 'trigger-1',
    kind: 'trigger',
    title: '用户输入',
    subtitle: '开始',
  }),
})

export const buildCanvasNodeData = (
  partial: Partial<CanvasNodeData> & Pick<CanvasNodeData, 'kind' | 'title' | 'subtitle'> & { nodeId?: string },
): CanvasNodeData => {
  const defaultInputs = partial.inputs ?? getDefaultInputs(partial.kind, partial.nodeId)
  let nextInputs = defaultInputs
  let nextOutputs = partial.outputs ?? getDefaultOutputs(partial.kind, defaultInputs)

  if (partial.kind === 'trigger') {
    const normalizedStartConfig = normalizeStartNodeConfig(defaultInputs)
    nextInputs = {
      ...normalizedStartConfig,
      _outputTypes: buildStartOutputTypes(normalizedStartConfig),
    } as Record<string, unknown>
    nextOutputs = partial.outputs ?? buildStartNodeOutputs(normalizedStartConfig)
  }

  if (partial.kind === 'llm') {
    const normalizedLlmConfig = normalizeLLMNodeConfig(defaultInputs)
    nextInputs = {
      ...normalizedLlmConfig,
      _outputTypes: buildLLMOutputTypes(normalizedLlmConfig),
    } as unknown as Record<string, unknown>
    nextOutputs = buildLLMNodeOutputs(normalizedLlmConfig)
  }

  if (partial.kind === 'end') {
    const normalizedEndConfig = normalizeEndNodeConfig(defaultInputs, partial.outputs)
    nextInputs = {
      ...normalizedEndConfig,
      _outputTypes: buildEndOutputTypesFromConfig(defaultInputs, partial.outputs),
    } as Record<string, unknown>
    nextOutputs = buildEndNodeOutputs(normalizedEndConfig)
  }

  return {
    kind: partial.kind,
    title: partial.title,
    subtitle: partial.subtitle,
    selected: partial.selected ?? false,
    inputs: nextInputs,
    outputs: nextOutputs,
    _targetBranches: partial.kind === 'condition'
      ? buildIfElseTargetBranches(
          normalizeIfElseNodeConfig(defaultInputs).cases,
        )
      : undefined,
    _datasets: partial.kind === 'knowledge'
      ? getKnowledgeDatasetsByIds(
          Array.isArray((defaultInputs as Record<string, unknown> | undefined)?.dataset_ids)
            ? ((defaultInputs as Record<string, unknown>).dataset_ids as string[])
            : [],
        )
      : undefined,
    _children: partial.kind === 'iteration'
      ? buildIterationChildren(
          normalizeIterationNodeConfig(defaultInputs, partial.nodeId).start_node_id,
        )
      : partial.kind === 'loop'
        ? buildLoopChildren(
            normalizeLoopNodeConfig(defaultInputs, partial.nodeId).start_node_id,
          )
        : undefined,
    _connectedSourceHandleIds: partial._connectedSourceHandleIds ?? [],
  }
}

export const hydrateCanvasNodesFromDsl = (dsl: AnyWorkflowDSL): Node<CanvasNodeData>[] => {
  const dslNodes = getWorkflowDslNodes(dsl)

  if (!dslNodes.length)
    return [createInitialTriggerNode()]

  return dslNodes.flatMap((node) => {
    const kind = resolveCanvasKindFromNode(node)
    if (!kind)
      return []

    const isContainerEndNode = kind === 'iteration-end' || kind === 'loop-end'
    const isLegacyNode = isLegacyWorkflowNode(node)
    const inputs = isLegacyNode
      ? node.data.inputs
      : deserializeNodeInputs(kind, node.data, node.id)
    const outputs = isLegacyNode
      ? node.data.outputs
      : undefined
    const title = isLegacyNode
      ? (typeof node.data.label === 'string' ? node.data.label : getNodeTitleFallback(kind))
      : (typeof node.data.title === 'string' ? node.data.title : getNodeTitleFallback(kind))
    const subtitle = isLegacyNode
      ? (typeof node.data.subtitle === 'string' ? node.data.subtitle : getNodeSubtitleFallback(kind))
      : getNodeSubtitleFallback(kind)

    return [{
      id: node.id,
      type: 'workflow',
      dragHandle: '.workflow-node-drag-surface',
      position: node.position,
      parentId: node.parentId,
      draggable: isContainerEndNode ? false : undefined,
      selectable: isContainerEndNode ? false : undefined,
      data: buildCanvasNodeData({
        nodeId: node.id,
        kind,
        title,
        subtitle,
        selected: false,
        inputs,
        outputs,
      }),
    }]
  })
}

export const createWorkflowDslFromCanvas = (
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  appName?: string,
): WorkflowDSL => ({
  app: {
    description: '',
    icon: '🤖',
    icon_background: '#FFEAD5',
    icon_type: 'emoji',
    mode: 'workflow',
    name: appName ?? 'workflow',
    use_icon_as_answer_icon: false,
  },
  dependencies: [],
  kind: 'app',
  version: '0.6.0',
  workflow: {
    conversation_variables: [],
    environment_variables: [],
    features: {
      file_upload: {
        allowed_file_extensions: ['.JPG', '.JPEG', '.PNG', '.GIF', '.WEBP', '.SVG'],
        allowed_file_types: ['image'],
        allowed_file_upload_methods: ['local_file', 'remote_url'],
        enabled: false,
        fileUploadConfig: {
          attachment_image_file_size_limit: 2,
          audio_file_size_limit: 50,
          batch_count_limit: 5,
          file_size_limit: 15,
          file_upload_limit: 50,
          image_file_batch_limit: 10,
          image_file_size_limit: 10,
          single_chunk_attachment_limit: 10,
          video_file_size_limit: 100,
          workflow_file_upload_limit: 10,
        },
        image: {
          enabled: false,
          number_limits: 3,
          transfer_methods: ['local_file', 'remote_url'],
        },
        number_limits: 3,
      },
      opening_statement: '',
      retriever_resource: {
        enabled: true,
      },
      sensitive_word_avoidance: {
        enabled: false,
      },
      speech_to_text: {
        enabled: false,
      },
      suggested_questions: [],
      suggested_questions_after_answer: {
        enabled: false,
      },
      text_to_speech: {
        enabled: false,
        language: '',
        voice: '',
      },
    },
    graph: {
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: serializeEdgeSourceHandle(edge.sourceHandle),
        targetHandle: serializeEdgeTargetHandle(edge.targetHandle),
        type: 'custom',
        zIndex: edge.zIndex ?? 0,
        data: edge.data,
      })),
      nodes: nodes.map((node) => {
        const dimensions = getDifyNodeDimensions(node.data.kind)

        return {
          id: node.id,
          type: 'custom',
          position: node.position,
          positionAbsolute: node.position,
          width: dimensions.width,
          height: dimensions.height,
          parentId: node.parentId,
          selected: Boolean(node.data.selected),
          sourcePosition: 'right',
          targetPosition: 'left',
          data: {
            selected: Boolean(node.data.selected),
            title: node.data.title,
            type: semanticTypeByKind[node.data.kind],
            ...serializeNodeInputs(node.data.kind, node.data.inputs, node.data.outputs, node.id),
          },
        }
      }),
      viewport: {
        x: 0,
        y: 0,
        zoom: 1,
      },
    },
    rag_pipeline_variables: [],
  },
})
