import { NodeRunStatus, WorkflowRunStatus } from './types.js'
import {
  appendWorkflowRunEvent,
  clearWorkflowRunEvents,
  formatWorkflowRunEventSse,
  listWorkflowRunEvents,
} from './workflowRunEvents.js'

describe('workflowRunEvents', () => {
  beforeEach(() => {
    clearWorkflowRunEvents('run_test')
  })

  it('stores and formats sse workflow events', () => {
    appendWorkflowRunEvent({
      type: 'node_started',
      runId: 'run_test',
      timestamp: 1,
      nodeId: 'llm-1',
      status: NodeRunStatus.Running,
    })
    appendWorkflowRunEvent({
      type: 'workflow_finished',
      runId: 'run_test',
      timestamp: 2,
      status: WorkflowRunStatus.Succeeded,
    })

    const events = listWorkflowRunEvents('run_test')
    expect(events).toHaveLength(2)
    expect(formatWorkflowRunEventSse(events[0]!)).toContain('"node_started"')
  })
})
