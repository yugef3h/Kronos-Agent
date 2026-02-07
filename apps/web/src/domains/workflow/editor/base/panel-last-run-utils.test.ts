import { NodeRunningStatus } from '../types/common'
import {
  buildPanelLastRunMeta,
  formatNodeRunStatusLabel,
  formatPanelLastRunElapsed,
  stringifyPanelLastRunPayload,
} from './panel-last-run-utils'

describe('panel-last-run-utils', () => {
  it('formats elapsed time', () => {
    expect(formatPanelLastRunElapsed(320)).toBe('320 ms')
    expect(formatPanelLastRunElapsed(1500)).toBe('1.50 s')
  })

  it('maps node status to label', () => {
    expect(formatNodeRunStatusLabel(NodeRunningStatus.Succeeded)).toBe('成功')
    expect(formatNodeRunStatusLabel(NodeRunningStatus.Failed)).toBe('失败')
  })

  it('stringifies payloads for copy blocks', () => {
    expect(stringifyPanelLastRunPayload({ query: 'hi' })).toContain('"query"')
    expect(stringifyPanelLastRunPayload(undefined)).toBe('{}')
  })

  it('builds meta for badges', () => {
    const meta = buildPanelLastRunMeta({
      runId: 'run_1',
      nodeId: 'start-1',
      status: NodeRunningStatus.Succeeded,
      elapsedMs: 42,
      finishedAt: 1_700_000_000_000,
    })

    expect(meta.statusLabel).toBe('成功')
    expect(meta.elapsedLabel).toBe('42 ms')
    expect(meta.statusClassName).toContain('emerald')
  })
})
