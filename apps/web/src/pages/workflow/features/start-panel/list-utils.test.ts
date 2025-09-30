import { getStartVariableSummary, reorderStartVariables } from './list-utils'
import type { StartVariable } from './types'

const createVariable = (id: string, overrides: Partial<StartVariable> = {}): StartVariable => ({
  id,
  variable: id,
  label: id,
  type: 'text-input',
  required: false,
  options: [],
  placeholder: '',
  hint: '',
  ...overrides,
})

describe('start-panel list utils', () => {
  it('moves the dragged variable onto the dropped row position', () => {
    const variables = [createVariable('a'), createVariable('b'), createVariable('c')]

    expect(reorderStartVariables(variables, 'a', 'c').map(variable => variable.id)).toEqual(['b', 'c', 'a'])
    expect(reorderStartVariables(variables, 'c', 'a').map(variable => variable.id)).toEqual(['c', 'a', 'b'])
  })

  it('builds compact summaries for dense row display', () => {
    expect(getStartVariableSummary(createVariable('selectVar', {
      type: 'select',
      options: ['beijing', 'shanghai'],
    }))).toBe('2 个选项')

    expect(getStartVariableSummary(createVariable('files', { type: 'file-list' }))).toBe('多文件')
    expect(getStartVariableSummary(createVariable('plain'))).toBe('')
  })
})