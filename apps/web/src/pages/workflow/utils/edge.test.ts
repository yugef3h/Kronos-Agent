import { NodeRunningStatus } from '../types/common'
import { getEdgeColor } from './edge'

describe('getEdgeColor', () => {
  it('returns a fallback-enabled normal edge color token', () => {
    expect(getEdgeColor()).toBe('var(--color-workflow-link-line-normal, #94a3b8)')
  })

  it('returns running color token for active edges', () => {
    expect(getEdgeColor(NodeRunningStatus.Running)).toBe('var(--color-workflow-link-line-handle, #3b82f6)')
  })

  it('returns failure color token for fail branches', () => {
    expect(getEdgeColor(NodeRunningStatus.Running, true)).toBe('var(--color-workflow-link-line-failure-handle, #f59e0b)')
  })
})