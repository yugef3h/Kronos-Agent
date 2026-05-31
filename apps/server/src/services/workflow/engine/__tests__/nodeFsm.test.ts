import { NodeRunStatus } from '../types.js'
import {
  NodeFsmTransitionError,
  canTransitionNodeRun,
  isNodeRunActive,
  transitionNodeRun,
} from '../nodeFsm.js'

describe('nodeFsm', () => {
  it('allows not-start to waiting to running', () => {
    expect(transitionNodeRun(NodeRunStatus.NotStart, NodeRunStatus.Waiting)).toBe(NodeRunStatus.Waiting)
    expect(transitionNodeRun(NodeRunStatus.Waiting, NodeRunStatus.Running)).toBe(NodeRunStatus.Running)
  })

  it('allows running to succeeded or failed', () => {
    expect(canTransitionNodeRun(NodeRunStatus.Running, NodeRunStatus.Succeeded)).toBe(true)
    expect(canTransitionNodeRun(NodeRunStatus.Running, NodeRunStatus.Failed)).toBe(true)
  })

  it('rejects transitions from terminal node states', () => {
    expect(() => transitionNodeRun(NodeRunStatus.Succeeded, NodeRunStatus.Running))
      .toThrow(NodeFsmTransitionError)
  })

  it('detects active node runs', () => {
    expect(isNodeRunActive(NodeRunStatus.Running)).toBe(true)
    expect(isNodeRunActive(NodeRunStatus.Paused)).toBe(false)
    expect(isNodeRunActive(NodeRunStatus.Succeeded)).toBe(false)
  })
})
