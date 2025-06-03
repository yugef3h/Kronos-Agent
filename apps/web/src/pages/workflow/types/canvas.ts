export type CanvasNodeData = {
  kind: 'llm' | 'knowledge' | 'end' | 'condition' | 'iteration' | 'loop' | 'trigger'
  title: string
  subtitle: string
  selected?: boolean
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
}