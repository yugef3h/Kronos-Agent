import { useMemo } from 'react'
import { produce } from 'immer'
import { createEmptyStartVariable, normalizeStartNodeConfig, validateStartNodeConfig } from './schema'
import type { StartNodeConfig, StartVariable } from './types'

type UseStartPanelConfigOptions = {
  value: unknown
  onChange: (nextValue: StartNodeConfig) => void
}

export const useStartPanelConfig = ({
  value,
  onChange,
}: UseStartPanelConfigOptions) => {
  const config = useMemo(() => normalizeStartNodeConfig(value), [value])
  const issues = useMemo(() => validateStartNodeConfig(config), [config])

  const update = (recipe: (draft: StartNodeConfig) => void) => {
    const nextValue = produce(config, recipe)
    onChange(nextValue)
  }

  const handleAddVariable = () => {
    update((draft) => {
      draft.variables.push(createEmptyStartVariable())
    })
  }

  const handleUpdateVariable = (variableId: string, patch: Partial<StartVariable>) => {
    update((draft) => {
      const target = draft.variables.find(variable => variable.id === variableId)
      if (!target)
        return

      Object.assign(target, patch)
    })
  }

  const handleRemoveVariable = (variableId: string) => {
    update((draft) => {
      draft.variables = draft.variables.filter(variable => variable.id !== variableId)
    })
  }

  const handleMoveVariable = (variableId: string, direction: 'up' | 'down') => {
    update((draft) => {
      const index = draft.variables.findIndex(variable => variable.id === variableId)
      if (index < 0)
        return

      const nextIndex = direction === 'up' ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= draft.variables.length)
        return

      const [target] = draft.variables.splice(index, 1)
      draft.variables.splice(nextIndex, 0, target)
    })
  }

  return {
    config,
    issues,
    handleAddVariable,
    handleUpdateVariable,
    handleRemoveVariable,
    handleMoveVariable,
  }
}