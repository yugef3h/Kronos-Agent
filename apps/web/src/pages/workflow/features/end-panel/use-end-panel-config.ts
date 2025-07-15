import { useMemo } from 'react'
import { produce } from 'immer'
import { createEmptyEndOutput, normalizeEndNodeConfig, validateEndNodeConfig } from './schema'
import type { EndNodeConfig, EndOutputDefinition } from './types'

type UseEndPanelConfigOptions = {
  value: unknown
  existingOutputs?: Record<string, unknown>
  onChange: (nextValue: EndNodeConfig) => void
}

export const useEndPanelConfig = ({
  value,
  existingOutputs,
  onChange,
}: UseEndPanelConfigOptions) => {
  const config = useMemo(() => normalizeEndNodeConfig(value, existingOutputs), [existingOutputs, value])
  const issues = useMemo(() => validateEndNodeConfig(config), [config])

  const update = (recipe: (draft: EndNodeConfig) => void) => {
    const nextValue = produce(config, recipe)
    onChange(nextValue)
  }

  const handleAddOutput = () => {
    update((draft) => {
      draft.outputs.push(createEmptyEndOutput())
    })
  }

  const handleUpdateOutput = (outputId: string, patch: Partial<EndOutputDefinition>) => {
    update((draft) => {
      const target = draft.outputs.find(output => output.id === outputId)
      if (!target)
        return

      Object.assign(target, patch)

      if (patch.variable_type === 'constant')
        target.value_selector = []

      if (patch.variable_type === 'variable')
        target.value = ''
    })
  }

  const handleRemoveOutput = (outputId: string) => {
    update((draft) => {
      draft.outputs = draft.outputs.filter(output => output.id !== outputId)
    })
  }

  const handleMoveOutput = (outputId: string, direction: 'up' | 'down') => {
    update((draft) => {
      const index = draft.outputs.findIndex(output => output.id === outputId)
      if (index < 0)
        return

      const nextIndex = direction === 'up' ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= draft.outputs.length)
        return

      const [target] = draft.outputs.splice(index, 1)
      draft.outputs.splice(nextIndex, 0, target)
    })
  }

  return {
    config,
    issues,
    handleAddOutput,
    handleUpdateOutput,
    handleRemoveOutput,
    handleMoveOutput,
  }
}