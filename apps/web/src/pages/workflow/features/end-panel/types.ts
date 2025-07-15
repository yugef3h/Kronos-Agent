import type { ValueSelector } from '../llm-panel/types'

export type EndOutputValueMode = 'variable' | 'constant'

export type EndOutputDefinition = {
  id: string
  variable: string
  value_selector: ValueSelector
  variable_type: EndOutputValueMode
  value: string
}

export type EndNodeConfig = {
  outputs: EndOutputDefinition[]
}

export type EndValidationIssue = {
  path: string
  message: string
}