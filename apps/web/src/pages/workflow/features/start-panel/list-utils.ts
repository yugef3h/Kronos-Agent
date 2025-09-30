import type { StartVariable } from './types'

export const reorderStartVariables = (
  variables: StartVariable[],
  activeId: string,
  overId: string,
) => {
  if (activeId === overId)
    return variables

  const activeIndex = variables.findIndex(variable => variable.id === activeId)
  const overIndex = variables.findIndex(variable => variable.id === overId)

  if (activeIndex < 0 || overIndex < 0)
    return variables

  const nextVariables = [...variables]
  const [activeVariable] = nextVariables.splice(activeIndex, 1)
  nextVariables.splice(overIndex, 0, activeVariable)

  return nextVariables
}

export const getStartVariableSummary = (variable: StartVariable) => {
  if (variable.type === 'select' && variable.options.length)
    return `${variable.options.length} 个选项`

  if (variable.type === 'file-list')
    return '多文件'

  if (variable.type === 'json' || variable.type === 'json_object')
    return '对象'

  return ''
}