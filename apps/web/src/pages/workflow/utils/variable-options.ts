import type { VariableOption, ValueSelector } from '../features/llm-panel/types'
import type { CanvasNodeData } from '../types/canvas'

type WorkflowNodeSnapshot = { id: string; data: CanvasNodeData; parentId?: string }
type WorkflowEdgeSnapshot = { source: string; target: string }

export const serializeValueSelector = (valueSelector: ValueSelector) => valueSelector.join('.')

const inferVariableType = (
  node: WorkflowNodeSnapshot,
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

const collectUpstreamNodeIds = (
  currentNodeId: string,
  edges: WorkflowEdgeSnapshot[],
) => {
  const visited = new Set<string>()
  const pending = [currentNodeId]

  while (pending.length) {
    const targetNodeId = pending.pop()
    if (!targetNodeId)
      continue

    edges
      .filter(edge => edge.target === targetNodeId)
      .forEach((edge) => {
        if (visited.has(edge.source))
          return

        visited.add(edge.source)
        pending.push(edge.source)
      })
  }

  return visited
}

export const buildWorkflowVariableOptions = (
  currentNodeId: string,
  nodes: WorkflowNodeSnapshot[],
  edges: WorkflowEdgeSnapshot[] = [],
  extraOptions: VariableOption[] = [],
): VariableOption[] => {
  const currentNode = nodes.find(node => node.id === currentNodeId)
  const currentParentId = currentNode?.parentId
  const upstreamNodeIds = edges.length ? collectUpstreamNodeIds(currentNodeId, edges) : null
  const upstreamContainerNodeIds = currentParentId && edges.length
    ? collectUpstreamNodeIds(currentParentId, edges)
    : null
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
        const isInRootScope = !candidateParentId || candidateParentId === currentNodeId
        if (!isInRootScope)
          return false

        return upstreamNodeIds ? upstreamNodeIds.has(node.id) : true
      }

      const isInSharedScope = !candidateParentId || candidateParentId === currentParentId || node.id === currentParentId
      if (!isInSharedScope)
        return false

      if (node.id === currentParentId)
        return true

      if (upstreamNodeIds?.has(node.id))
        return true

      return upstreamContainerNodeIds ? upstreamContainerNodeIds.has(node.id) : true
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