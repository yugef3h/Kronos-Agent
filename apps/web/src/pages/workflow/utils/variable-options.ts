import type { VariableOption, ValueSelector } from '../features/llm-panel/types'
import type { CanvasNodeData } from '../types/canvas'

export const serializeValueSelector = (valueSelector: ValueSelector) => valueSelector.join('.')

const inferVariableType = (
  outputKey: string,
  outputValue: unknown,
): VariableOption['valueType'] => {
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
  nodes: Array<{ id: string; data: CanvasNodeData }>,
  extraOptions: VariableOption[] = [],
): VariableOption[] => {
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
    .filter(node => node.id !== currentNodeId)
    .sort((left, right) => left.data.title.localeCompare(right.data.title, 'zh-CN'))
    .flatMap((node) => {
      const outputs = node.data.outputs ?? {}
      const outputKeys = Object.keys(outputs)

      if (!outputKeys.length)
        return []

      return outputKeys.map<VariableOption>((outputKey) => ({
        label: `${node.data.title}.${outputKey}`,
        valueSelector: [node.id, outputKey],
        valueType: inferVariableType(outputKey, outputs[outputKey]),
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