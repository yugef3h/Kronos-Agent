import { normalizeEndNodeConfig, validateEndNodeConfig } from '../panels/end-panel/schema'
import { normalizeIfElseNodeConfig, validateIfElseNodeConfig } from '../panels/ifelse-panel/schema'
import {
  normalizeKnowledgeRetrievalNodeConfig,
  validateKnowledgeRetrievalNodeConfig,
} from '../panels/knowledge-retrieval-panel/schema'
import { normalizeLLMNodeConfig, validateLLMNodeConfig } from '../panels/llm-panel/schema'
import { normalizeStartNodeConfig, validateStartNodeConfig } from '../panels/start-panel/schema'
import type { CanvasNodeData } from '../types/canvas'
import { canQuickRunCanvasNode } from './build-canvas-node-debug-options'

export type CanvasNodeQuickRunValidation =
  | { ok: true }
  | { ok: false; messages: string[] }

const fail = (messages: string[]): CanvasNodeQuickRunValidation => ({
  ok: false,
  messages,
})

export const validateCanvasNodeQuickRun = (
  appId: string | null | undefined,
  data: CanvasNodeData,
): CanvasNodeQuickRunValidation => {
  if (!appId?.trim()) {
    return fail(['缺少工作流 appId，无法运行。'])
  }

  if (!canQuickRunCanvasNode(data.kind)) {
    return fail(['该节点类型暂不支持单节点运行。'])
  }

  switch (data.kind) {
    case 'trigger': {
      const issues = validateStartNodeConfig(normalizeStartNodeConfig(data.inputs))
      return issues.length > 0 ? fail(issues.map((issue) => issue.message)) : { ok: true }
    }
    case 'knowledge': {
      const config = normalizeKnowledgeRetrievalNodeConfig(data.inputs)
      const issues = validateKnowledgeRetrievalNodeConfig(config)
      return issues.length > 0 ? fail(issues.map((issue) => issue.message)) : { ok: true }
    }
    case 'llm': {
      const config = normalizeLLMNodeConfig(data.inputs)
      if (config.model.mode === 'completion') {
        return fail(['当前为 Completion 模式，请先在节点 Panel 中配置可调试的 Chat 模型与提示词。'])
      }
      const issues = validateLLMNodeConfig(config)
      return issues.length > 0 ? fail(issues.map((issue) => issue.message)) : { ok: true }
    }
    case 'condition': {
      const issues = validateIfElseNodeConfig(normalizeIfElseNodeConfig(data.inputs))
      return issues.length > 0 ? fail(issues.map((issue) => issue.message)) : { ok: true }
    }
    case 'end': {
      const issues = validateEndNodeConfig(normalizeEndNodeConfig(data.inputs))
      return issues.length > 0 ? fail(issues.map((issue) => issue.message)) : { ok: true }
    }
    default:
      return fail(['该节点类型暂不支持单节点运行。'])
  }
}
