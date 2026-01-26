import type { NodeRunningStatus } from './common'
import type { NodeLastRunSnapshot } from './run'
import type { ContainerChildSummary } from '../panels/container-panel/runtime'
import type { IfElseBranch } from '../panels/ifelse-panel/types'
import type { KnowledgeDatasetDetail, KnowledgeRetrievalDebugRun } from '../panels/knowledge-retrieval-panel/types'

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
  /**
   * @deprecated Prefer `_lastRun` (knowledge panel migration in a later step).
   * Until then, readers should fall back: `_lastRun ?? adaptKnowledgeLastRun(_knowledgeLastRun)`.
   */
  _knowledgeLastRun?: KnowledgeRetrievalDebugRun
  /** Live status while a draft run or node debug is in progress (not persisted to DSL). */
  _runStatus?: NodeRunningStatus
  /** Latest completed debug or full-run snapshot for the「上次运行」panel tab. */
  _lastRun?: NodeLastRunSnapshot
  _children?: ContainerChildSummary[]
  _targetBranches?: IfElseBranch[]
  _connectedSourceHandleIds?: string[]
  _requiredIssueCount?: number
}