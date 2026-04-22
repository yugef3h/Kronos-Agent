import { NodeRunningStatus } from '../types/common'
import {
  buildWorkflowRunEventsFromNodeRuns,
  shouldStaggerWorkflowRunEvent,
} from './replay-workflow-draft-run-events'

describe('replay-workflow-draft-run-events', () => {
  it('builds node lifecycle events from nodeRuns', () => {
    const events = buildWorkflowRunEventsFromNodeRuns('run_1', [
      {
        nodeId: 'b',
        nodeType: 'llm',
        status: NodeRunningStatus.Succeeded,
        startedAt: 20,
        finishedAt: 30,
        elapsedMs: 10,
      },
      {
        nodeId: 'a',
        nodeType: 'start',
        status: NodeRunningStatus.Succeeded,
        startedAt: 1,
        finishedAt: 2,
        elapsedMs: 1,
      },
    ])

    expect(events.map((event) => event.type)).toEqual([
      'node_started',
      'node_finished',
      'node_started',
      'node_finished',
    ])
    expect(events[0]?.nodeId).toBe('a')
    expect(events[2]?.nodeId).toBe('b')
  })

  it('only staggers node_started and node_finished', () => {
    expect(shouldStaggerWorkflowRunEvent({ type: 'node_started', runId: 'r', timestamp: 0 })).toBe(true)
    expect(shouldStaggerWorkflowRunEvent({ type: 'workflow_finished', runId: 'r', timestamp: 0 })).toBe(false)
  })
})
