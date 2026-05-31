import { NodeRunStatus, WorkflowRunStatus } from '../../types.js'
import {
  appendWorkflowRunEvent,
  clearWorkflowRunEvents,
  formatWorkflowRunEventSse,
  listWorkflowRunEvents,
} from '../../workflowRunEvents.js'

describe('workflowRunEvents', () => {
  beforeEach(async () => {
    await clearWorkflowRunEvents('run_test')
  })

  it('stores and formats sse workflow events', async () => {
    await appendWorkflowRunEvent({
      type: 'node_started',
      runId: 'run_test',
      timestamp: 1,
      nodeId: 'llm-1',
      status: NodeRunStatus.Running,
    })
    await appendWorkflowRunEvent({
      type: 'workflow_finished',
      runId: 'run_test',
      timestamp: 2,
      status: WorkflowRunStatus.Succeeded,
    })

    const events = await listWorkflowRunEvents('run_test')
    expect(events).toHaveLength(2)
    expect(formatWorkflowRunEventSse(events[0]!)).toContain('"node_started"')
  })
})
