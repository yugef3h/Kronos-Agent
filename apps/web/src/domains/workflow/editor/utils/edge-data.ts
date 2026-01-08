import type { CommonEdgeType } from '../types/common'

type EdgeRuntimeData = Pick<
  CommonEdgeType,
  '_sourceRunningStatus' | '_targetRunningStatus' | '_waitingRun'
>

const DEFAULT_EDGE_RUNTIME_DATA: EdgeRuntimeData = {
  _sourceRunningStatus: undefined,
  _targetRunningStatus: undefined,
  _waitingRun: true,
}

export const resolveEdgeRuntimeData = (
  data?: Partial<CommonEdgeType>,
): EdgeRuntimeData & Partial<CommonEdgeType> => {
  return {
    ...DEFAULT_EDGE_RUNTIME_DATA,
    ...(data ?? {}),
  }
}

export const createWorkflowEdgeData = (
  data: Pick<CommonEdgeType, 'sourceType' | 'targetType'> & Partial<CommonEdgeType>,
): CommonEdgeType => {
  return {
    ...DEFAULT_EDGE_RUNTIME_DATA,
    ...data,
  }
}