import { useMemo } from 'react'
import { produce } from 'immer'
import type { VariableOption } from '../llm-panel/types'
import {
  createDefaultIterationNodeConfig,
  deriveIterationOutputType,
  normalizeIterationNodeConfig,
  validateIterationNodeConfig,
} from './schema'
import type { IterationErrorHandleMode, IterationNodeConfig } from './types'

type UseIterationPanelConfigOptions = {
  nodeId: string
  value: unknown
  onChange: (nextValue: IterationNodeConfig) => void
}

export const useIterationPanelConfig = ({
  nodeId,
  value,
  onChange,
}: UseIterationPanelConfigOptions) => {
  const config = useMemo(() => normalizeIterationNodeConfig(value, nodeId), [nodeId, value])
  const issues = useMemo(() => validateIterationNodeConfig(config), [config])

  const update = (recipe: (draft: IterationNodeConfig) => void) => {
    const nextValue = produce(config, recipe)
    onChange(nextValue)
  }

  const handleIteratorSelectorChange = (valueSelector: string[], itemOption?: VariableOption) => {
    update((draft) => {
      draft.iterator_selector = valueSelector

      const isUsingCurrentItem = draft.output_selector.join('.') === `${nodeId}.item`
      if (!draft.output_selector.length || isUsingCurrentItem) {
        draft.output_selector = [nodeId, 'item']
        draft.output_type = deriveIterationOutputType(itemOption)
      }
    })
  }

  const handleOutputSelectorChange = (valueSelector: string[], option?: VariableOption) => {
    update((draft) => {
      draft.output_selector = valueSelector
      draft.output_type = deriveIterationOutputType(option)
    })
  }

  const handleParallelChange = (checked: boolean) => {
    update((draft) => {
      draft.is_parallel = checked
      if (!checked)
        draft.parallel_nums = createDefaultIterationNodeConfig(nodeId).parallel_nums
    })
  }

  const handleParallelNumsChange = (value: number | null) => {
    update((draft) => {
      draft.parallel_nums = value === null ? createDefaultIterationNodeConfig(nodeId).parallel_nums : Math.round(value)
    })
  }

  const handleErrorHandleModeChange = (value: IterationErrorHandleMode) => {
    update((draft) => {
      draft.error_handle_mode = value
    })
  }

  const handleFlattenOutputChange = (checked: boolean) => {
    update((draft) => {
      draft.flatten_output = checked
    })
  }

  return {
    config,
    issues,
    handleIteratorSelectorChange,
    handleOutputSelectorChange,
    handleParallelChange,
    handleParallelNumsChange,
    handleErrorHandleModeChange,
    handleFlattenOutputChange,
  }
}