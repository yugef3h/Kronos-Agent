import type { ValueSelector } from '../llm-panel/types'

export type IterationErrorHandleMode = 'terminated' | 'continue_on_error' | 'remove_abnormal_output'
export type IterationOutputType = 'array' | 'arrayString' | 'arrayNumber' | 'arrayObject' | 'arrayFile' | 'arrayBoolean'

export type IterationNodeConfig = {
  start_node_id: string
  iterator_selector: ValueSelector
  output_selector: ValueSelector
  output_type: IterationOutputType
  is_parallel: boolean
  parallel_nums: number
  error_handle_mode: IterationErrorHandleMode
  flatten_output: boolean
  isInIteration: boolean
  isInLoop: boolean
}

export type IterationValidationIssue = {
  path: string
  message: string
}