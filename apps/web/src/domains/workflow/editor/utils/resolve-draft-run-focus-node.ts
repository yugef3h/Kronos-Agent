import type { Node } from 'reactflow'
import type { WorkflowDraftNodeRunRecord } from '../../app/workflowRunApi'
import type { CanvasNodeData } from '../types/canvas'
import { NodeRunningStatus } from '../types/common'
import { WorkflowRunStatus, type WorkflowRunSummary } from '../types/run'

const isFailedNodeRunStatus = (status: NodeRunningStatus | string): boolean =>
  status === NodeRunningStatus.Failed || status === NodeRunningStatus.Exception

/** 测试运行结束或中断时，应聚焦并打开 Panel 的节点 id。 */
export const resolveDraftRunFocusNodeId = (
  nodes: Array<Node<CanvasNodeData>>,
  options?: {
    nodeRuns?: WorkflowDraftNodeRunRecord[]
    run?: WorkflowRunSummary | null
  },
): string | null => {
  const nodeRuns = options?.nodeRuns ?? []
  const run = options?.run

  const failedFromRuns = [...nodeRuns]
    .reverse()
    .find((record) => isFailedNodeRunStatus(record.status))

  if (failedFromRuns) {
    return failedFromRuns.nodeId
  }

  const failedOnCanvas = [...nodes]
    .reverse()
    .find((node) => node.data._runStatus && isFailedNodeRunStatus(node.data._runStatus))

  if (failedOnCanvas) {
    return failedOnCanvas.id
  }

  if (
    run?.status === WorkflowRunStatus.Succeeded
    || run?.status === WorkflowRunStatus.Failed
  ) {
    const endNode = nodes.find((node) => node.data.kind === 'end')
    if (endNode) {
      return endNode.id
    }
  }

  const lastRun = nodeRuns[nodeRuns.length - 1]
  if (lastRun) {
    return lastRun.nodeId
  }

  return null
}
