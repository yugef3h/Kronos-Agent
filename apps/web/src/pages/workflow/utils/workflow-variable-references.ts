import type { Node } from 'reactflow'
import type { CanvasNodeData } from '../types/canvas'

const SELECTOR_KEY_PATTERN = /(Selector|_selector)$/

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

const isSelectorKey = (key: string) => {
  return key === 'valueSelector' || key === 'value_selector' || SELECTOR_KEY_PATTERN.test(key)
}

const isSameSelector = (value: string[], selector: string[]) => {
  return value.length === selector.length && value.every((item, index) => item === selector[index])
}

const updateReferenceValue = (
  value: unknown,
  previousSelector: string[],
  nextSelector: string[] | null,
): unknown => {
  if (Array.isArray(value)) {
    const nextItems = value.map(item => updateReferenceValue(item, previousSelector, nextSelector))
    const changed = nextItems.some((item, index) => item !== value[index])
    return changed ? nextItems : value
  }

  if (typeof value !== 'object' || value === null)
    return value

  let changed = false
  const nextRecord: Record<string, unknown> = {}

  Object.entries(value).forEach(([key, current]) => {
    if (isSelectorKey(key) && isStringArray(current) && isSameSelector(current, previousSelector)) {
      nextRecord[key] = nextSelector ?? []
      changed = true
      return
    }

    const nextValue = updateReferenceValue(current, previousSelector, nextSelector)
    nextRecord[key] = nextValue
    if (nextValue !== current)
      changed = true
  })

  return changed ? nextRecord : value
}

export const rewriteNodeVariableReference = (
  node: Node<CanvasNodeData>,
  previousSelector: string[],
  nextSelector: string[] | null,
) => {
  const nextInputs = updateReferenceValue(node.data.inputs, previousSelector, nextSelector)

  if (nextInputs === node.data.inputs)
    return node

  return {
    ...node,
    data: {
      ...node.data,
      inputs: nextInputs as Record<string, unknown> | undefined,
    },
  }
}

export const rewriteNodesVariableReferences = (
  nodes: Node<CanvasNodeData>[],
  previousSelector: string[],
  nextSelector: string[] | null,
  excludeNodeId?: string,
) => {
  return nodes.map((node) => {
    if (node.id === excludeNodeId)
      return node

    return rewriteNodeVariableReference(node, previousSelector, nextSelector)
  })
}