import { NodeRunningStatus } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import { adaptKnowledgeLastRun, resolveNodeLastRun } from './resolve-node-last-run'

describe('resolve-node-last-run', () => {
  it('prefers _lastRun over legacy knowledge snapshot', () => {
    const data = {
      kind: 'knowledge',
      title: 'k',
      subtitle: '',
      _lastRun: {
        runId: 'run_1',
        nodeId: 'k-1',
        status: NodeRunningStatus.Succeeded,
        outputs: { text: 'new' },
      },
      _knowledgeLastRun: {
        requestedAt: 1,
        query: 'old',
        items: [],
        diagnostics: {
          retrieval_mode: 'oneWay',
          dataset_count: 0,
          total_chunk_count: 0,
          filtered_chunk_count: 0,
        },
      },
    } as CanvasNodeData

    expect(resolveNodeLastRun('k-1', data)?.outputs).toEqual({ text: 'new' })
  })

  it('adapts legacy knowledge debug run', () => {
    const snapshot = adaptKnowledgeLastRun({
      requestedAt: 100,
      query: 'q',
      items: [],
      diagnostics: {
        retrieval_mode: 'multiWay',
        dataset_count: 1,
        total_chunk_count: 2,
        filtered_chunk_count: 1,
      },
    }, 'k-2')

    expect(snapshot.inputs?.query).toBe('q')
    expect(snapshot.nodeId).toBe('k-2')
  })
})
