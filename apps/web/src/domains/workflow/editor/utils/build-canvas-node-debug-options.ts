import { normalizeEndNodeConfig } from '../panels/end-panel/schema'
import { normalizeIfElseNodeConfig } from '../panels/ifelse-panel/schema'
import { normalizeKnowledgeRetrievalNodeConfig } from '../panels/knowledge-retrieval-panel/schema'
import { normalizeLLMNodeConfig } from '../panels/llm-panel/schema'
import { buildStartPanelDebugInputs } from '../panels/start-panel/debug-inputs'
import { normalizeStartNodeConfig } from '../panels/start-panel/schema'
import type { CanvasNodeData } from '../types/canvas'
import type { UseNodeDebugRunOptions } from '../hooks/use-node-debug-run'
import { resolveNodeDebugBlockKind } from './node-debug-kind'

export const CANVAS_NODE_DEBUG_MOCK_QUERY = '示例查询'

const mockDebugContext = (): Record<string, unknown> => ({
  sys: { query: CANVAS_NODE_DEBUG_MOCK_QUERY },
})

/** 画布节点快捷运行：无 Panel 调试参数时的默认 debug 载荷 */
export const buildCanvasNodeDebugRunOptions = (
  appId: string | null | undefined,
  nodeId: string,
  data: CanvasNodeData,
): UseNodeDebugRunOptions | null => {
  if (!resolveNodeDebugBlockKind(data.kind)) {
    return null
  }

  const base = { appId, nodeId, nodeKind: data.kind }

  switch (data.kind) {
    case 'trigger': {
      const config = normalizeStartNodeConfig(data.inputs)
      return {
        ...base,
        nodeInputs: { variables: config.variables },
        debugInputs: buildStartPanelDebugInputs(config, { query: CANVAS_NODE_DEBUG_MOCK_QUERY }),
      }
    }
    case 'knowledge': {
      const config = normalizeKnowledgeRetrievalNodeConfig(data.inputs)
      return {
        ...base,
        nodeInputs: config as unknown as Record<string, unknown>,
        debugInputs: { query: CANVAS_NODE_DEBUG_MOCK_QUERY },
        contextVariables: mockDebugContext(),
      }
    }
    case 'llm': {
      const config = normalizeLLMNodeConfig(data.inputs)
      return {
        ...base,
        nodeInputs: config as unknown as Record<string, unknown>,
        contextVariables: mockDebugContext(),
      }
    }
    case 'condition': {
      const config = normalizeIfElseNodeConfig(data.inputs)
      return {
        ...base,
        nodeInputs: config as unknown as Record<string, unknown>,
        contextVariables: mockDebugContext(),
      }
    }
    case 'end': {
      const config = normalizeEndNodeConfig(data.inputs)
      return {
        ...base,
        nodeInputs: config as unknown as Record<string, unknown>,
        nodeOutputs: data.outputs,
        contextVariables: mockDebugContext(),
      }
    }
    default:
      return null
  }
}

const QUICK_RUN_NODE_KINDS = new Set<CanvasNodeData['kind']>([
  'trigger',
  'knowledge',
  'llm',
  'condition',
  'end',
])

export const canQuickRunCanvasNode = (kind: CanvasNodeData['kind']): boolean =>
  QUICK_RUN_NODE_KINDS.has(kind)
