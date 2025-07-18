import { useMemo } from 'react'
import { produce } from 'immer'
import { createEmptyStartVariable, normalizeStartNodeConfig, validateStartNodeConfig } from './schema'
import type { StartNodeConfig, StartVariable } from './types'

type UseStartPanelConfigOptions = {
  value: unknown
  onChange: (
    nextValue: StartNodeConfig,
    meta?:
      | { type: 'rename-variable'; previousVariable: string; nextVariable: string }
      | { type: 'remove-variable'; variable: string },
  ) => void
}

export const useStartPanelConfig = ({
  value,
  onChange,
}: UseStartPanelConfigOptions) => {
  const config = useMemo(() => normalizeStartNodeConfig(value), [value])
  const issues = useMemo(() => validateStartNodeConfig(config), [config])

  const update = (
    recipe: (draft: StartNodeConfig) => void,
    meta?:
      | { type: 'rename-variable'; previousVariable: string; nextVariable: string }
      | { type: 'remove-variable'; variable: string },
  ) => {
    const nextValue = produce(config, recipe)
    onChange(nextValue, meta)
  }

  const handleAddVariable = () => {
    update((draft) => {
      draft.variables.push(createEmptyStartVariable())
    })
  }

  const handleUpdateVariable = (variableId: string, patch: Partial<StartVariable>) => {
    const currentVariable = config.variables.find(variable => variable.id === variableId)
    if (!currentVariable)
      return

    const previousVariable = currentVariable.variable.trim()
    const nextVariable = (patch.variable ?? currentVariable.variable).trim()

    update((draft) => {
      const target = draft.variables.find(variable => variable.id === variableId)
      if (!target)
        return

      Object.assign(target, patch)
    }, patch.variable !== undefined && previousVariable && nextVariable && previousVariable !== nextVariable
      ? { type: 'rename-variable', previousVariable, nextVariable }
      : undefined)
  }

  const handleRemoveVariable = (variableId: string) => {
    const currentVariable = config.variables.find(variable => variable.id === variableId)
    const removedVariable = currentVariable?.variable.trim()

    update((draft) => {
      draft.variables = draft.variables.filter(variable => variable.id !== variableId)
    }, removedVariable
      ? { type: 'remove-variable', variable: removedVariable }
      : undefined)
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