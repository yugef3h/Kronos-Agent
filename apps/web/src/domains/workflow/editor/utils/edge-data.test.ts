import { BlockEnum, NodeRunningStatus } from '../types/common'
import {
  createWorkflowEdgeData,
  resolveEdgeRuntimeData,
} from './edge-data'

describe('edge-data', () => {
  it('provides Dify-style default runtime state for new edges', () => {
    const edgeData = createWorkflowEdgeData({
      sourceType: BlockEnum.Start,
      targetType: BlockEnum.LLM,
    })

    expect(edgeData).toMatchObject({
      sourceType: BlockEnum.Start,
      targetType: BlockEnum.LLM,
      _sourceRunningStatus: undefined,
      _targetRunningStatus: undefined,
      _waitingRun: true,
    })
  })

  it('keeps source and target running status when downstream starts running', () => {
    const runtimeData = resolveEdgeRuntimeData({
      _sourceRunningStatus: NodeRunningStatus.Succeeded,
      _targetRunningStatus: NodeRunningStatus.Running,
      _waitingRun: false,
    })

    expect(runtimeData).toMatchObject({
      _sourceRunningStatus: NodeRunningStatus.Succeeded,
      _targetRunningStatus: NodeRunningStatus.Running,
      _waitingRun: false,
    })
  })
})