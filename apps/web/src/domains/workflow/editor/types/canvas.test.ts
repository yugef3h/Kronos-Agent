import { NodeRunningStatus } from './common'
import type { CanvasNodeData } from './canvas'

describe('CanvasNodeData runtime fields', () => {
  it('accepts _runStatus and _lastRun', () => {
    const data: CanvasNodeData = {
      kind: 'llm',
      title: 'LLM',
      subtitle: '模型',
      _runStatus: NodeRunningStatus.Running,
      _lastRun: {
        runId: 'run_test',
        nodeId: 'llm-1',
        status: NodeRunningStatus.Succeeded,
        elapsedMs: 42,
        outputs: { text: 'ok' },
      },
    }

    expect(data._runStatus).toBe('running')
    expect(data._lastRun?.outputs?.text).toBe('ok')
  })

  it('still allows legacy _knowledgeLastRun', () => {
    const data: CanvasNodeData = {
      kind: 'knowledge',
      title: '知识检索',
      subtitle: '检索',
      _knowledgeLastRun: {
        requestedAt: 1,
        query: 'q',
        items: [],
        diagnostics: {
          retrieval_mode: 'oneWay',
          dataset_count: 0,
          total_chunk_count: 0,
          filtered_chunk_count: 0,
        },
      },
    }

    expect(data._knowledgeLastRun?.query).toBe('q')
  })
})
