import { describe, expect, it } from '@jest/globals'
import { validateCanvasNodeQuickRun } from './validate-canvas-node-quick-run'
import type { CanvasNodeData } from '../types/canvas'

describe('validateCanvasNodeQuickRun', () => {
  it('requires appId', () => {
    const result = validateCanvasNodeQuickRun(null, {
      kind: 'trigger',
      title: 'start',
      subtitle: '',
    } as CanvasNodeData)

    expect(result).toEqual({
      ok: false,
      messages: [expect.stringContaining('appId')],
    })
  })

  it('requires knowledge datasets', () => {
    const result = validateCanvasNodeQuickRun('wf_test', {
      kind: 'knowledge',
      title: 'kb',
      subtitle: '',
      inputs: {
        dataset_ids: [],
        query_variable_selector: ['sys', 'query'],
      },
    } as CanvasNodeData)

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      messages: expect.arrayContaining(['至少选择一个知识库。']),
    })
  })

  it('passes valid knowledge node', () => {
    const result = validateCanvasNodeQuickRun('wf_test', {
      kind: 'knowledge',
      title: 'kb',
      subtitle: '',
      inputs: {
        dataset_ids: ['ds-1'],
        query_variable_selector: ['sys', 'query'],
      },
    } as CanvasNodeData)

    expect(result).toEqual({ ok: true })
  })
})
