import type { VariableOption, ValueSelector } from '../features/llm-panel/types'
import type { CanvasNodeData } from '../types/canvas'

export const serializeValueSelector = (valueSelector: ValueSelector) => valueSelector.join('.')

const inferVariableType = (
  node: { id: string; data: CanvasNodeData },
  outputKey: string,
  outputValue: unknown,
): VariableOption['valueType'] => {
  const explicitOutputTypes = (node.data.inputs as { _outputTypes?: Record<string, unknown> } | undefined)?._outputTypes
  const explicitOutputType = explicitOutputTypes?.[outputKey]

  if (typeof explicitOutputType === 'string' && ['string', 'number', 'boolean', 'array', 'object', 'file'].includes(explicitOutputType)) {
    return explicitOutputType as VariableOption['valueType']
  }

  if (typeof outputValue === 'number')
    return 'number'

  if (typeof outputValue === 'boolean')
    return 'boolean'

  if (Array.isArray(outputValue))
    return 'array'

  if (outputKey.includes('file'))
    return 'file'

  if (outputKey === 'usage' || (typeof outputValue === 'object' && outputValue !== null))
    return 'object'

  return 'string'
}

export const buildWorkflowVariableOptions = (
  currentNodeId: string,
  nodes: Array<{ id: string; data: CanvasNodeData; parentId?: string }>,
  extraOptions: VariableOption[] = [],
): VariableOption[] => {
  const currentNode = nodes.find(node => node.id === currentNodeId)
  const currentParentId = currentNode?.parentId
  const systemVariables: VariableOption[] = [
    {
      label: 'sys.query',
      valueSelector: ['sys', 'query'],
      valueType: 'string',
      source: 'system',
    },
    {
      label: 'sys.files',
      valueSelector: ['sys', 'files'],
      valueType: 'file',
      source: 'system',
    },
    {
      label: 'sys.conversation_id',
      valueSelector: ['sys', 'conversation_id'],
      valueType: 'string',
      source: 'system',
    },
  ]

  const nodeVariables = nodes
    .filter((node) => {
      if (node.id === currentNodeId)
        return false

      const candidateParentId = node.parentId

      if (!currentParentId) {
        return !candidateParentId || candidateParentId === currentNodeId
      }

      return !candidateParentId || candidateParentId === currentParentId || node.id === currentParentId
    })
    .sort((left, right) => left.data.title.localeCompare(right.data.title, 'zh-CN'))
    .flatMap((node) => {
      const outputs = node.data.outputs ?? {}
      const outputKeys = Object.keys(outputs)

      if (!outputKeys.length)
        return []

      return outputKeys.map<VariableOption>((outputKey) => ({
        label: `${node.data.title}.${outputKey}`,
        valueSelector: [node.id, outputKey],
        valueType: inferVariableType(node, outputKey, outputs[outputKey]),
        source: 'node',
      }))
    })

  const merged = [...extraOptions, ...systemVariables, ...nodeVariables]
  const seen = new Set<string>()

  return merged.filter((option) => {
    const serialized = serializeValueSelector(option.valueSelector)
    if (seen.has(serialized))
      return false

    seen.add(serialized)
    return true
  })
}