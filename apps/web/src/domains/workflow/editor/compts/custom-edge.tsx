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
import {
  WORKFLOW_EDGE_CURVATURE,
  WORKFLOW_EDGE_STROKE_WIDTH,
  resolveWorkflowSourceX,
} from '../utils/edge-geometry'
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
    sourceX: resolveWorkflowSourceX(sourceX),
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
    curvature: WORKFLOW_EDGE_CURVATURE,
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

  const isErrorEdge = useMemo(
    () =>
      _sourceRunningStatus === NodeRunningStatus.Failed
      || _sourceRunningStatus === NodeRunningStatus.Exception
      || _targetRunningStatus === NodeRunningStatus.Failed
      || _targetRunningStatus === NodeRunningStatus.Exception,
    [_sourceRunningStatus, _targetRunningStatus],
  )

  const stroke = useMemo(() => {
    if (selected)
      return getEdgeColor(NodeRunningStatus.Running)

    if (linearGradientId)
      return `url(#${linearGradientId})`

    if (_connectedNodeIsHovering)
      return getEdgeColor(NodeRunningStatus.Running, sourceHandleId === ErrorHandleTypeEnum.failBranch)

    return getEdgeColor()
  }, [_connectedNodeIsHovering, linearGradientId, selected, sourceHandleId])

  const strokeWidth = isErrorEdge
    ? WORKFLOW_EDGE_STROKE_WIDTH + 0.5
    : WORKFLOW_EDGE_STROKE_WIDTH

  return (
    <>
      {
        linearGradientId && (
          <CustomEdgeLinearGradientRender
            id={linearGradientId}
            startColor={getEdgeColor(_sourceRunningStatus)}
            stopColor={getEdgeColor(_targetRunningStatus)}
            position={{
              x1: resolveWorkflowSourceX(sourceX),
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
          strokeWidth,
          opacity: _waitingRun ? 0.7 : 1,
        }}
      />
    </>
  )
}

export default memo(CustomEdge)
