import type { ContainerChildSummary } from '../features/container-panel/runtime'
import type { IfElseBranch } from '../features/ifelse-panel/types'
import type { KnowledgeDatasetDetail } from '../features/knowledge-retrieval-panel/types'

export type CanvasNodeData = {
  kind: 'llm' | 'knowledge' | 'end' | 'condition' | 'iteration' | 'loop' | 'trigger'
  title: string
  subtitle: string
  selected?: boolean
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  _datasets?: KnowledgeDatasetDetail[]
  _children?: ContainerChildSummary[]
  _targetBranches?: IfElseBranch[]
  _connectedSourceHandleIds?: string[]
}