import { NodeRunningStatus } from '../types/common'
import { toNodeLastRunSnapshot } from './to-node-last-run-snapshot'

describe('toNodeLastRunSnapshot', () => {
  it('maps debug API response to canvas snapshot', () => {
    const snapshot = toNodeLastRunSnapshot({
      result: {
        nodeId: 'start-1',
        status: NodeRunningStatus.Succeeded,
        startedAt: 100,
        finishedAt: 120,
        elapsedMs: 20,
        inputs: { query: 'hi' },
        outputs: { query: 'hi' },
      },
      run: {
        runId: 'run_test',
        appId: 'wf_demo',
        status: 'succeeded' as never,
        startedAt: 100,
      },
    })

    expect(snapshot).toEqual({
      runId: 'run_test',
      nodeId: 'start-1',
      status: NodeRunningStatus.Succeeded,
      startedAt: 100,
      finishedAt: 120,
      elapsedMs: 20,
      inputs: { query: 'hi' },
      outputs: { query: 'hi' },
    })
  })
})
