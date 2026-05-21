import { resolvePromptVariableMenuTrigger } from '../config-page/promptVariablesUtils'
import { formatWorkflowVariableToken } from './workflow-prompt-variable-utils'

describe('workflow prompt variable trigger', () => {
  it('opens menu on single {', () => {
    expect(resolvePromptVariableMenuTrigger('hello {', 7)).toEqual({
      kind: 'single',
      start: 6,
      filter: '',
    })
  })

  it('opens menu on /', () => {
    expect(resolvePromptVariableMenuTrigger('hello /q', 8)).toEqual({
      kind: 'single',
      start: 6,
      filter: 'q',
    })
  })

  it('formats workflow token', () => {
    expect(formatWorkflowVariableToken(['sys', 'query'])).toBe('{{#sys.query#}}')
  })
})
