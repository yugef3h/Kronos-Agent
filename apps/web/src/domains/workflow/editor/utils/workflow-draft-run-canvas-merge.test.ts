import type { Node } from 'reactflow'
import type { WorkflowDraftNodeRunRecord } from '../../app/workflowRunApi'
import type { CanvasNodeData } from '../types/canvas'
import { BlockEnum, NodeRunningStatus, type Edge } from '../types/common'
import {
  applyNodeLastRunsFromDraftRun,
  applyWorkflowDraftNodeRunsToCanvas,
  applyWorkflowRunEventToCanvas,
  clearWorkflowRunCanvasState,
} from './apply-run-event-to-canvas'

const createNode = (id: string): Node<CanvasNodeData> => ({
  id,
  type: 'workflow',
  position: { x: 0, y: 0 },
  data: {
    kind: 'llm',
    title: id,
    subtitle: 'llm',
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

describe('workflow draft run canvas merge', () => {
  it('replays events then persists unified lastRun from nodeRuns', () => {
    const nodeRuns: WorkflowDraftNodeRunRecord[] = [{
      nodeId: 'llm-1',
      nodeType: 'llm',
      status: NodeRunningStatus.Succeeded,
      startedAt: 1,
      finishedAt: 2,
      elapsedMs: 1,
      outputs: { text: 'draft ok' },
    }]

    let nodes = [createNode('llm-1'), createNode('end-1')]
    let edges = [createEdge('llm-1', 'end-1')]

    const replayed = applyWorkflowRunEventToCanvas(nodes, edges, {
      type: 'node_started',
      runId: 'run_merge',
      timestamp: 1,
      nodeId: 'llm-1',
    })
    nodes = replayed.nodes
    edges = replayed.edges

    const withStatuses = applyWorkflowDraftNodeRunsToCanvas(nodes, edges, nodeRuns)
    const final = {
      nodes: applyNodeLastRunsFromDraftRun(withStatuses.nodes, 'run_merge', nodeRuns),
      edges: withStatuses.edges,
    }

    expect(final.nodes.find((node) => node.id === 'llm-1')?.data._runStatus).toBe(NodeRunningStatus.Succeeded)
    expect(final.nodes.find((node) => node.id === 'llm-1')?.data._lastRun).toEqual({
      runId: 'run_merge',
      nodeId: 'llm-1',
      status: NodeRunningStatus.Succeeded,
      startedAt: 1,
      finishedAt: 2,
      elapsedMs: 1,
      outputs: { text: 'draft ok' },
    })
    expect(final.edges[0]?.data?._sourceRunningStatus).toBe(NodeRunningStatus.Succeeded)
  })

  it('clears live status without dropping lastRun before the next run', () => {
    const nodes: Array<Node<CanvasNodeData>> = [{
      ...createNode('llm-1'),
      data: {
        ...createNode('llm-1').data,
        _runStatus: NodeRunningStatus.Running,
        _lastRun: {
          runId: 'run_prev',
          nodeId: 'llm-1',
          status: NodeRunningStatus.Succeeded,
          outputs: { text: 'prev' },
        },
      },
    }]

    const cleared = clearWorkflowRunCanvasState(nodes, [createEdge('llm-1', 'end-1')])

    expect(cleared.nodes[0]?.data._runStatus).toBeUndefined()
    expect(cleared.nodes[0]?.data._lastRun?.outputs).toEqual({ text: 'prev' })
  })
})
