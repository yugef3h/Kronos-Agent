import { describe, expect, it } from '@jest/globals'
import {
  buildCanvasNodeDebugRunOptions,
  CANVAS_NODE_DEBUG_MOCK_QUERY,
  canQuickRunCanvasNode,
} from './build-canvas-node-debug-options'
import type { CanvasNodeData } from '../types/canvas'

describe('buildCanvasNodeDebugRunOptions', () => {
  it('builds start debug inputs with mock query', () => {
    const options = buildCanvasNodeDebugRunOptions('wf_test', 'trigger-1', {
      kind: 'trigger',
      title: 'start',
      subtitle: '',
      inputs: { variables: [] },
    } as CanvasNodeData)

    expect(options?.debugInputs?.query).toBe(CANVAS_NODE_DEBUG_MOCK_QUERY)
  })

  it('returns null for unsupported container kinds', () => {
    expect(canQuickRunCanvasNode('iteration')).toBe(false)
    expect(
      buildCanvasNodeDebugRunOptions('wf_test', 'iter-1', {
        kind: 'iteration',
        title: 'iteration',
        subtitle: '',
      } as CanvasNodeData),
    ).toBeNull()
  })

  it('builds knowledge debug query', () => {
    const options = buildCanvasNodeDebugRunOptions('wf_test', 'kr-1', {
      kind: 'knowledge',
      title: 'kb',
      subtitle: '',
      inputs: { dataset_ids: ['ds-1'] },
    } as CanvasNodeData)

    expect(options?.debugInputs).toEqual({ query: CANVAS_NODE_DEBUG_MOCK_QUERY })
  })
})
