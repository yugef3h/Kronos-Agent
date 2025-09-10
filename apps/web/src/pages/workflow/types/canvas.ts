import type { ContainerChildSummary } from '../features/container-panel/runtime'
import type { IfElseBranch } from '../features/ifelse-panel/types'
import type { KnowledgeDatasetDetail, KnowledgeRetrievalDebugRun } from '../features/knowledge-retrieval-panel/types'

export type WorkflowCanvasNodeKind =
  | 'llm'
  | 'knowledge'
  | 'end'
  | 'condition'
  | 'iteration'
  | 'loop'
  | 'trigger'
  | 'iteration-start'
  | 'iteration-end'
  | 'loop-end'
  | 'loop-start'

export type CanvasNodeData = {
  kind: WorkflowCanvasNodeKind
  title: string
  subtitle: string
  selected?: boolean
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  _datasets?: KnowledgeDatasetDetail[]
  _knowledgeLastRun?: KnowledgeRetrievalDebugRun
  _children?: ContainerChildSummary[]
  _targetBranches?: IfElseBranch[]
  _connectedSourceHandleIds?: string[]
}