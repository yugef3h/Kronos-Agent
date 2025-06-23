import type { EdgeProps } from 'reactflow'
import {
  memo,
  useMemo,
} from 'react'
import {
  BaseEdge,
  getBezierPath,
  Position,
} from 'reactflow'
import {
  type CommonEdgeType,
  NodeRunningStatus,
} from '../types/common'
import { getEdgeColor } from '../utils/edge'
import { resolveEdgeRuntimeData } from '../utils/edge-data'
import { ErrorHandleTypeEnum } from '../types/error-handle'
import CustomEdgeLinearGradientRender from './custom-edge-linear-gradient-render'

const CustomEdge = ({
  id,
  data,
  sourceHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
}: EdgeProps<CommonEdgeType>) => {
  const [
    edgePath,
  ] = getBezierPath({
    sourceX: data?.isInIteration || data?.isInLoop ? sourceX - 4 : sourceX - 8,
    sourceY,
    sourcePosition: Position.Right,
    targetX: data?.isInIteration || data?.isInLoop ? targetX + 4 : targetX + 8,
    targetY,
    targetPosition: Position.Left,
    curvature: data?.isInIteration || data?.isInLoop ? 0.22 : 0.16,
  })
  const {
    _connectedNodeIsHovering,
    _sourceRunningStatus,
    _targetRunningStatus,
    _waitingRun,
  } = resolveEdgeRuntimeData(data)

  const linearGradientId = useMemo(() => {
    if (
      (
        _sourceRunningStatus === NodeRunningStatus.Succeeded
        || _sourceRunningStatus === NodeRunningStatus.Failed
        || _sourceRunningStatus === NodeRunningStatus.Exception
      ) && (
        _targetRunningStatus === NodeRunningStatus.Succeeded
        || _targetRunningStatus === NodeRunningStatus.Failed
        || _targetRunningStatus === NodeRunningStatus.Exception
        || _targetRunningStatus === NodeRunningStatus.Running
      )
    ) {
      return id
    }
  }, [_sourceRunningStatus, _targetRunningStatus, id])

  const stroke = useMemo(() => {
    if (selected)
      return getEdgeColor(NodeRunningStatus.Running)

    if (linearGradientId)
      return `url(#${linearGradientId})`

    if (_connectedNodeIsHovering)
      return getEdgeColor(NodeRunningStatus.Running, sourceHandleId === ErrorHandleTypeEnum.failBranch)

    return getEdgeColor()
  }, [_connectedNodeIsHovering, linearGradientId, selected, sourceHandleId])

  return (
    <>
      {
        linearGradientId && (
          <CustomEdgeLinearGradientRender
            id={linearGradientId}
            startColor={getEdgeColor(_sourceRunningStatus)}
            stopColor={getEdgeColor(_targetRunningStatus)}
            position={{
              x1: sourceX,
              y1: sourceY,
              x2: targetX,
              y2: targetY,
            }}
          />
        )
      }
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth: 2,
          opacity: _waitingRun ? 0.7 : 1,
        }}
      />
    </>
  )
}

export default memo(CustomEdge)
