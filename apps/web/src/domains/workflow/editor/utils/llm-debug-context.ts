export type LlmDebugVariableField = {
  path: string
  label: string
  kind: 'query' | 'text' | 'json'
  required: boolean
}
