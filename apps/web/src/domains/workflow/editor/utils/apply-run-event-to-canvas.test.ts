import type { Node } from 'reactflow'
import type { WorkflowRunEvent } from '../../app/workflowRunApi'
import type { CanvasNodeData } from '../types/canvas'
import { BlockEnum, NodeRunningStatus, type Edge } from '../types/common'
import {
  applyWorkflowDraftNodeRunsToCanvas,
  applyWorkflowRunEventToCanvas,
  clearWorkflowRunCanvasState,
  syncEdgesRunningStatus,
} from './apply-run-event-to-canvas'

const createNode = (
  id: string,
  runStatus?: NodeRunningStatus,
): Node<CanvasNodeData> => ({
  id,
  type: 'workflow',
  position: { x: 0, y: 0 },
  data: {
    kind: 'llm',
    title: id,
    subtitle: 'llm',
    ...(runStatus ? { _runStatus: runStatus } : {}),
  },
})

const createEdge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  data: {
    sourceType: BlockEnum.LLM,
    targetType: BlockEnum.End,
    _waitingRun: true,
  },
})

describe('apply-run-event-to-canvas', () => {
  it('marks node running on node_started', () => {
    const nodes = [createNode('a'), createNode('b')]
    const edges = [createEdge('a', 'b')]

    const event: WorkflowRunEvent = {
      type: 'node_started',
      runId: 'run_1',
      timestamp: Date.now(),
      nodeId: 'a',
    }

    const result = applyWorkflowRunEventToCanvas(nodes, edges, event)

    expect(result.nodes.find((node) => node.id === 'a')?.data._runStatus).toBe(NodeRunningStatus.Running)
    expect(result.edges[0]?.data?._sourceRunningStatus).toBe(NodeRunningStatus.Running)
    expect(result.edges[0]?.data?._waitingRun).toBe(false)
  })

  it('syncs edge statuses from node map', () => {
    const nodes = [
      createNode('a', NodeRunningStatus.Succeeded),
      createNode('b', NodeRunningStatus.Running),
    ]
    const edges = syncEdgesRunningStatus([createEdge('a', 'b')], nodes)

    expect(edges[0]?.data?._sourceRunningStatus).toBe(NodeRunningStatus.Succeeded)
    expect(edges[0]?.data?._targetRunningStatus).toBe(NodeRunningStatus.Running)
  })

  it('clears run visuals without removing last run', () => {
    const nodes: Array<Node<CanvasNodeData>> = [{
      ...createNode('a', NodeRunningStatus.Running),
      data: {
        ...createNode('a', NodeRunningStatus.Running).data,
        _lastRun: {
          runId: 'run_1',
          nodeId: 'a',
          status: NodeRunningStatus.Succeeded,
        },
      },
    }]

    const cleared = clearWorkflowRunCanvasState(nodes, [createEdge('a', 'b')])

    expect(cleared.nodes[0]?.data._runStatus).toBeUndefined()
    expect(cleared.nodes[0]?.data._lastRun?.runId).toBe('run_1')
  })

  it('applies node run records in order', () => {
    const nodes = [createNode('a'), createNode('b')]
    const edges = [createEdge('a', 'b')]

    const result = applyWorkflowDraftNodeRunsToCanvas(nodes, edges, [
      {
        nodeId: 'a',
        nodeType: 'start',
        status: NodeRunningStatus.Succeeded,
        startedAt: 1,
        finishedAt: 2,
        elapsedMs: 1,
      },
      {
        nodeId: 'b',
        nodeType: 'end',
        status: NodeRunningStatus.Succeeded,
        startedAt: 2,
        finishedAt: 3,
        elapsedMs: 1,
      },
    ])

    expect(result.nodes.find((node) => node.id === 'b')?.data._runStatus).toBe(NodeRunningStatus.Succeeded)
  })
})
