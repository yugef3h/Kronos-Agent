import { BlockEnum } from '../types/common'

type WorkflowNodeKind = 'trigger' | 'agent' | 'llm' | 'knowledge' | 'end'

type PanelNodeData = {
  kind?: WorkflowNodeKind
  type?: string
}

const WORKFLOW_NODE_KIND_TO_BLOCK: Record<WorkflowNodeKind, BlockEnum> = {
  trigger: BlockEnum.Start,
  agent: BlockEnum.LLM,
  llm: BlockEnum.LLM,
  knowledge: BlockEnum.LLM,
  end: BlockEnum.End,
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
