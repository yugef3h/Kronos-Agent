import { NodeRunningStatus } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import type { NodeLastRunSnapshot } from '../types/run'
import type { KnowledgeRetrievalDebugRun } from '../panels/knowledge-retrieval-panel/types'

export const adaptKnowledgeLastRun = (
  run: KnowledgeRetrievalDebugRun,
  nodeId = '',
): NodeLastRunSnapshot => ({
  runId: '',
  nodeId,
  status: NodeRunningStatus.Succeeded,
  startedAt: run.requestedAt,
  finishedAt: run.requestedAt,
  inputs: { query: run.query },
  outputs: {
    items: run.items,
    diagnostics: run.diagnostics,
  },
})

export const resolveNodeLastRun = (
  nodeId: string,
  data: CanvasNodeData,
): NodeLastRunSnapshot | null | undefined => {
  if (data._lastRun) {
    return data._lastRun
  }

  if (data._knowledgeLastRun) {
    return adaptKnowledgeLastRun(data._knowledgeLastRun, nodeId)
  }

  return null
}
