import { NodeRunningStatus } from '../types/common'
import {
  toNodeLastRunSnapshot,
  toNodeLastRunSnapshotFromDraftRun,
} from './to-node-last-run-snapshot'

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

  it('maps draft run node record to the same snapshot shape', () => {
    const snapshot = toNodeLastRunSnapshotFromDraftRun('run_draft', {
      nodeId: 'llm-1',
      nodeType: 'llm',
      status: NodeRunningStatus.Succeeded,
      startedAt: 1,
      finishedAt: 2,
      elapsedMs: 1,
      outputs: { text: 'ok' },
    })

    expect(snapshot).toEqual({
      runId: 'run_draft',
      nodeId: 'llm-1',
      status: NodeRunningStatus.Succeeded,
      startedAt: 1,
      finishedAt: 2,
      elapsedMs: 1,
      outputs: { text: 'ok' },
    })
  })
})
