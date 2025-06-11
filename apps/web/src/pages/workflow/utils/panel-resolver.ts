import { BlockEnum } from '../types/common'

type WorkflowNodeKind = 'trigger' | 'agent' | 'llm' | 'knowledge' | 'end' | 'condition' | 'iteration' | 'loop'

type PanelNodeData = {
  kind?: WorkflowNodeKind
  type?: string
}

const WORKFLOW_NODE_KIND_TO_BLOCK: Record<WorkflowNodeKind, BlockEnum> = {
  trigger: BlockEnum.Start,
  agent: BlockEnum.LLM,
  llm: BlockEnum.LLM,
  knowledge: BlockEnum.KnowledgeRetrieval,
  end: BlockEnum.End,
  condition: BlockEnum.IfElse,
  iteration: BlockEnum.Iteration,
  loop: BlockEnum.Loop,
}

export const resolvePanelBlockType = (
  nodeType: string | null | undefined,
  nodeData: PanelNodeData | null | undefined,
): BlockEnum | undefined => {
  if (!nodeType || !nodeData)
    return undefined

  if (nodeType === 'custom' && nodeData.type)
    return nodeData.type as BlockEnum

  if (nodeType === 'workflow' && nodeData.kind)
    return WORKFLOW_NODE_KIND_TO_BLOCK[nodeData.kind]

  return undefined
}
