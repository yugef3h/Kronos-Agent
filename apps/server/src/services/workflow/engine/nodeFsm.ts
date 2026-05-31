import { NodeRunStatus, isTerminalNodeRunStatus } from './types.js'

export class NodeFsmTransitionError extends Error {
  readonly from: NodeRunStatus
  readonly to: NodeRunStatus

  constructor(from: NodeRunStatus, to: NodeRunStatus) {
    super(`Invalid node run transition: ${from} -> ${to}`)
    this.name = 'NodeFsmTransitionError'
    this.from = from
    this.to = to
  }
}

const NODE_FSM_TRANSITIONS: Readonly<Record<NodeRunStatus, readonly NodeRunStatus[]>> = {
  [NodeRunStatus.NotStart]: [NodeRunStatus.Waiting],
  [NodeRunStatus.Waiting]: [NodeRunStatus.Running, NodeRunStatus.Stopped],
  [NodeRunStatus.Listening]: [NodeRunStatus.Running, NodeRunStatus.Stopped],
  [NodeRunStatus.Running]: [
    NodeRunStatus.Succeeded,
    NodeRunStatus.Failed,
    NodeRunStatus.Exception,
    NodeRunStatus.Stopped,
    NodeRunStatus.Paused,
    NodeRunStatus.Retry,
  ],
  [NodeRunStatus.Retry]: [NodeRunStatus.Running, NodeRunStatus.Failed],
  [NodeRunStatus.Paused]: [NodeRunStatus.Running, NodeRunStatus.Stopped],
  [NodeRunStatus.Succeeded]: [],
  [NodeRunStatus.Failed]: [],
  [NodeRunStatus.Exception]: [],
  [NodeRunStatus.Stopped]: [],
}

export const getAllowedNodeRunTransitions = (status: NodeRunStatus): readonly NodeRunStatus[] =>
  NODE_FSM_TRANSITIONS[status] ?? []

export const canTransitionNodeRun = (from: NodeRunStatus, to: NodeRunStatus): boolean => {
  if (from === to) {
    return true
  }

  return getAllowedNodeRunTransitions(from).includes(to)
}

export const assertNodeRunTransition = (from: NodeRunStatus, to: NodeRunStatus): void => {
  if (!canTransitionNodeRun(from, to)) {
    throw new NodeFsmTransitionError(from, to)
  }
}

export const transitionNodeRun = (from: NodeRunStatus, to: NodeRunStatus): NodeRunStatus => {
  assertNodeRunTransition(from, to)
  return to
}

export const isNodeRunActive = (status: NodeRunStatus): boolean =>
  !isTerminalNodeRunStatus(status) && status !== NodeRunStatus.Paused
