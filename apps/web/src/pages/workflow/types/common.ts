

import type {
  Edge as ReactFlowEdge,
} from 'reactflow'

export enum WorkflowRunningStatus {
  Waiting = 'waiting',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Stopped = 'stopped',
  Paused = 'paused',
}


export enum NodeRunningStatus {
  NotStart = 'not-start',
  Waiting = 'waiting',
  Listening = 'listening',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Exception = 'exception',
  Retry = 'retry',
  Stopped = 'stopped',
  Paused = 'paused',
}


export enum BlockEnum {
  Start = 'start',
  End = 'end',
  LLM = 'llm',
  IfElse = 'if-else',
  Loop = 'loop',
  LoopStart = 'loop-start',
  LoopEnd = 'loop-end',
  Iteration = 'iteration',
  IterationStart = 'iteration-start',
  KnowledgeRetrieval = 'knowledge-retrieval',
}

export type CommonEdgeType = {
  _hovering?: boolean
  _connectedNodeIsHovering?: boolean
  _connectedNodeIsSelected?: boolean
  _isBundled?: boolean
  _sourceRunningStatus?: NodeRunningStatus
  _targetRunningStatus?: NodeRunningStatus
  _waitingRun?: boolean
  isInIteration?: boolean
  iteration_id?: string
  isInLoop?: boolean
  loop_id?: string
  sourceType: BlockEnum
  targetType: BlockEnum
  _isTemp?: boolean
}

export type Edge = ReactFlowEdge<CommonEdgeType>

// 复用你现有类型
export type AppendableNodeKind = 'llm' | 'knowledge' | 'end' | 'condition' | 'iteration' | 'loop' | 'trigger';
