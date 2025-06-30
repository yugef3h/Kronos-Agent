import type { Node } from 'reactflow'
import type { VariableOption } from '../llm-panel/types'
import type { CanvasNodeData, WorkflowCanvasNodeKind } from '../../types/canvas'
import type { BlockEnum } from '../../types/common'
import type { ContainerChildSummary, ContainerKind } from './runtime'
import { NODE_WIDTH } from '../../constants'

export const CONTAINER_NODE_WIDTH = NODE_WIDTH
export const CONTAINER_NODE_MIN_HEIGHT = 156
export const CONTAINER_NODE_HORIZONTAL_PADDING = 12
export const CONTAINER_NODE_RIGHT_PADDING = 12
export const CONTAINER_NODE_TOP_PADDING = 66
export const CONTAINER_NODE_BOTTOM_PADDING = 18
export const CONTAINER_NODE_BOARD_TOP = 60
export const CONTAINER_CHILD_X_GAP = 208
export const CONTAINER_CHILD_Y_GAP = 110
export const CONTAINER_START_NODE_WIDTH = 216
export const CONTAINER_START_NODE_COLLAPSED_WIDTH = 64
export const CONTAINER_START_ICON_OFFSET = 20
export const CONTAINER_START_ICON_SIZE = 32
export const CONTAINER_START_HANDLE_RIGHT_OFFSET = CONTAINER_START_NODE_COLLAPSED_WIDTH - (CONTAINER_START_ICON_OFFSET + CONTAINER_START_ICON_SIZE + 4)
export const CONTAINER_END_NODE_WIDTH = 152
export const CONTAINER_CHILD_NODE_WIDTH = 172
export const CONTAINER_CHILD_NODE_HEIGHT = 88
export const CONTAINER_CONDITION_NODE_WIDTH = 220

const OUTPUT_VALUE_TYPES: VariableOption['valueType'][] = ['string', 'number', 'boolean', 'array', 'object', 'file']

export const isContainerNodeKind = (kind: WorkflowCanvasNodeKind): kind is ContainerKind => {
  return kind === 'iteration' || kind === 'loop'
}

export const isContainerStartKind = (kind: WorkflowCanvasNodeKind): kind is 'iteration-start' | 'loop-start' => {
  return kind === 'iteration-start' || kind === 'loop-start'
}

export const isContainerEndKind = (kind: WorkflowCanvasNodeKind): kind is 'iteration-end' | 'loop-end' => {
  return kind === 'iteration-end' || kind === 'loop-end'
}

export const resolveContainerStartKind = (kind: ContainerKind): 'iteration-start' | 'loop-start' => {
  return kind === 'iteration' ? 'iteration-start' : 'loop-start'
}

export const resolveContainerEndKind = (kind: ContainerKind): 'iteration-end' | 'loop-end' => {
  return kind === 'iteration' ? 'iteration-end' : 'loop-end'
}

export const buildContainerStartPosition = () => ({
  x: CONTAINER_NODE_HORIZONTAL_PADDING,
  y: CONTAINER_NODE_TOP_PADDING,
})

export const buildContainerChildPosition = (index: number) => ({
  x: CONTAINER_NODE_HORIZONTAL_PADDING + CONTAINER_CHILD_X_GAP * Math.max(index, 0),
  y: CONTAINER_NODE_TOP_PADDING + CONTAINER_CHILD_Y_GAP * Math.max(index, 0),
})

export const getContainerChildNodeWidth = (kind: WorkflowCanvasNodeKind) => {
  if (isContainerStartKind(kind))
    return CONTAINER_START_NODE_WIDTH

  if (isContainerEndKind(kind))
    return CONTAINER_END_NODE_WIDTH

  if (kind === 'condition')
    return CONTAINER_CONDITION_NODE_WIDTH

  return CONTAINER_CHILD_NODE_WIDTH
}

export const getContainerNodeRenderedWidth = (node: Node<CanvasNodeData>) => {
  const styleWidth = Number(node.style?.width)
  if (!Number.isNaN(styleWidth) && styleWidth > 0)
    return styleWidth

  return getContainerChildNodeWidth(node.data.kind)
}

export const getContainerNodeRenderedHeight = (node: Node<CanvasNodeData>) => {
  const styleHeight = Number(node.style?.height)
  if (!Number.isNaN(styleHeight) && styleHeight > 0)
    return styleHeight

  return getContainerChildNodeHeight(node.data.kind)
}

export const getContainerChildNodeHeight = (kind: WorkflowCanvasNodeKind) => {
  if (isContainerStartKind(kind) || isContainerEndKind(kind))
    return 72

  if (kind === 'condition')
    return 140

  return CONTAINER_CHILD_NODE_HEIGHT
}

const buildIterationStartOutputs = (itemValueType: VariableOption['valueType']) => {
  switch (itemValueType) {
    case 'number':
      return { item: 0, index: 0 }
    case 'boolean':
      return { item: false, index: 0 }
    case 'array':
      return { item: [], index: 0 }
    case 'file':
      return { item: '', index: 0 }
    case 'object':
      return { item: {}, index: 0 }
    default:
      return { item: '', index: 0 }
  }
}

type LoopVariableLike = {
  label: string
  var_type: VariableOption['valueType'] | 'array' | 'object'
  value: unknown
}

const buildLoopStartOutputs = (loopVariables: LoopVariableLike[]) => {
  return loopVariables.reduce<Record<string, unknown>>((accumulator, loopVariable) => {
    const label = loopVariable.label.trim()
    if (!label)
      return accumulator

    accumulator[label] = loopVariable.value
    return accumulator
  }, { index: 0 })
}

const buildLoopStartOutputTypes = (loopVariables: LoopVariableLike[]) => {
  return loopVariables.reduce<Record<string, VariableOption['valueType']>>((accumulator, loopVariable) => {
    const label = loopVariable.label.trim()
    if (!label)
      return accumulator

    accumulator[label] = OUTPUT_VALUE_TYPES.includes(loopVariable.var_type as VariableOption['valueType'])
      ? loopVariable.var_type as VariableOption['valueType']
      : 'string'
    return accumulator
  }, { index: 'number' })
}

export const buildContainerStartNode = ({
  containerId,
  startNodeId,
  kind,
  itemValueType = 'object',
  loopVariables = [],
}: {
  containerId: string
  startNodeId: string
  kind: ContainerKind
  itemValueType?: VariableOption['valueType']
  loopVariables?: LoopVariableLike[]
}): Node<CanvasNodeData> => {
  const isIteration = kind === 'iteration'
  const outputs = isIteration ? buildIterationStartOutputs(itemValueType) : buildLoopStartOutputs(loopVariables)
  const outputTypes = isIteration
    ? { item: itemValueType, index: 'number' as VariableOption['valueType'] }
    : buildLoopStartOutputTypes(loopVariables)

  return {
    id: startNodeId,
    type: 'workflow',
    parentId: containerId,
    extent: 'parent',
    draggable: true,
    selectable: true,
    position: buildContainerStartPosition(),
    zIndex: 1003,
    data: {
      kind: resolveContainerStartKind(kind),
      title: isIteration ? 'Iteration Start' : 'Loop Start',
      subtitle: '内部入口',
      selected: false,
      inputs: {
        _outputTypes: outputTypes,
      },
      outputs,
    },
  }
}

export const buildContainerEndNodeData = (kind: ContainerKind): Pick<CanvasNodeData, 'kind' | 'title' | 'subtitle' | 'inputs' | 'outputs'> => {
  if (kind === 'iteration') {
    return {
      kind: 'iteration-end',
      title: 'Iteration End',
      subtitle: '内部结束',
      inputs: {
        _outputTypes: {
          item: 'object',
          done: 'boolean',
        },
      },
      outputs: {
        item: null,
        done: true,
      },
    }
  }

  return {
    kind: 'loop-end',
    title: 'Loop End',
    subtitle: '内部结束',
    inputs: {
      _outputTypes: {
        done: 'boolean',
      },
    },
    outputs: {
      done: true,
    },
  }
}

export const buildContainerChildSummaries = (
  nodes: Array<Node<CanvasNodeData>>,
  containerId: string,
): ContainerChildSummary[] => {
  return nodes
    .filter(node => node.parentId === containerId)
    .sort((left, right) => {
      if (left.position.x === right.position.x)
        return left.position.y - right.position.y

      return left.position.x - right.position.x
    })
    .map((node) => ({
      nodeId: node.id,
      nodeType: node.data.kind as ContainerChildSummary['nodeType'],
    }))
}

export const getContainerBlockEnum = (kind: WorkflowCanvasNodeKind): BlockEnum | null => {
  switch (kind) {
    case 'trigger':
      return 'start' as BlockEnum
    case 'llm':
      return 'llm' as BlockEnum
    case 'knowledge':
      return 'knowledge-retrieval' as BlockEnum
    case 'condition':
      return 'if-else' as BlockEnum
    case 'iteration':
      return 'iteration' as BlockEnum
    case 'loop':
      return 'loop' as BlockEnum
    case 'iteration-start':
      return 'iteration-start' as BlockEnum
    case 'iteration-end':
      return 'iteration-end' as BlockEnum
    case 'loop-start':
      return 'loop-start' as BlockEnum
    case 'loop-end':
      return 'loop-end' as BlockEnum
    case 'end':
      return 'end' as BlockEnum
    default:
      return null
  }
}

export const buildContainerLayout = ({
  containerId,
  nodes,
  edges: _edges,
}: {
  containerId: string
  nodes: Array<Node<CanvasNodeData>>
  edges: Array<{ source: string; target: string }>
}) => {
  const childNodes = nodes.filter(node => node.parentId === containerId)
  const positions = new Map<string, { x: number; y: number }>()
  let maxRight = CONTAINER_NODE_WIDTH
  let maxBottom = CONTAINER_NODE_MIN_HEIGHT

  childNodes.forEach((node) => {
    positions.set(node.id, node.position)
    maxRight = Math.max(
      maxRight,
      node.position.x
        + getContainerNodeRenderedWidth(node)
        + CONTAINER_NODE_RIGHT_PADDING
        + CONTAINER_NODE_HORIZONTAL_PADDING,
    )
    maxBottom = Math.max(maxBottom, node.position.y + getContainerNodeRenderedHeight(node) + CONTAINER_NODE_BOTTOM_PADDING)
  })

  return {
    positions,
    width: Math.max(CONTAINER_NODE_WIDTH, maxRight),
    height: Math.max(CONTAINER_NODE_MIN_HEIGHT, maxBottom),
  }
}