export type ContainerKind = 'iteration' | 'loop'

export type ContainerChildSummary = {
  nodeId: string
  nodeType: 'iteration-start' | 'loop-start'
}

export const buildContainerStartNodeId = (nodeId: string | undefined, kind: ContainerKind) => {
  const baseId = nodeId?.trim() || `${kind}-${Date.now().toString(36)}`
  return `${baseId}__${kind}_start`
}

export const buildContainerChildren = (
  kind: ContainerKind,
  startNodeId: string,
): ContainerChildSummary[] => {
  return [{
    nodeId: startNodeId,
    nodeType: kind === 'iteration' ? 'iteration-start' : 'loop-start',
  }]
}