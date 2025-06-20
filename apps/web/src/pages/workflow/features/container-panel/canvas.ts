import type { Node } from 'reactflow'
import type { VariableOption } from '../llm-panel/types'
import type { CanvasNodeData, WorkflowCanvasNodeKind } from '../../types/canvas'
import type { BlockEnum } from '../../types/common'
import type { ContainerChildSummary, ContainerKind } from './runtime'

export const CONTAINER_NODE_WIDTH = 560
export const CONTAINER_NODE_MIN_HEIGHT = 260
export const CONTAINER_CHILD_START_X = 28
export const CONTAINER_CHILD_START_Y = 96
export const CONTAINER_CHILD_X_GAP = 198
export const CONTAINER_CHILD_Y_GAP = 94

const OUTPUT_VALUE_TYPES: VariableOption['valueType'][] = ['string', 'number', 'boolean', 'array', 'object', 'file']

export const isContainerNodeKind = (kind: WorkflowCanvasNodeKind): kind is ContainerKind => {
  return kind === 'iteration' || kind === 'loop'
}

export const isContainerStartKind = (kind: WorkflowCanvasNodeKind): kind is 'iteration-start' | 'loop-start' => {
  return kind === 'iteration-start' || kind === 'loop-start'
}

export const resolveContainerStartKind = (kind: ContainerKind): 'iteration-start' | 'loop-start' => {
  return kind === 'iteration' ? 'iteration-start' : 'loop-start'
}

export const buildContainerStartPosition = () => ({
  x: CONTAINER_CHILD_START_X,
  y: CONTAINER_CHILD_START_Y,
})

export const buildContainerChildPosition = (index: number) => ({
  x: CONTAINER_CHILD_START_X + CONTAINER_CHILD_X_GAP * Math.max(index, 0),
  y: CONTAINER_CHILD_START_Y + CONTAINER_CHILD_Y_GAP * Math.max(index - 2, 0),
})

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
    draggable: false,
    selectable: false,
    position: buildContainerStartPosition(),
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
    case 'loop-start':
      return 'loop-start' as BlockEnum
    case 'end':
      return 'end' as BlockEnum
    default:
      return null
  }
}