import {
  ELSE_BRANCH_ID,
  buildIfElseTargetBranches,
  comparisonOperatorRequiresValue,
  createDefaultIfElseNodeConfig,
  normalizeIfElseNodeConfig,
  validateIfElseNodeConfig,
} from './schema'

describe('ifelse-panel schema', () => {
  it('creates a valid default config shell', () => {
    const config = createDefaultIfElseNodeConfig()

    expect(config.cases).toHaveLength(1)
    expect(config.cases[0].case_id).toBe('true')
    expect(config.cases[0].logical_operator).toBe('and')
    expect(config.cases[0].conditions).toEqual([])
  })

  it('normalizes legacy condition payloads into cases', () => {
    const config = normalizeIfElseNodeConfig({
      logical_operator: 'or',
      conditions: [{
        id: 'condition-1',
        variable_selector: ['sys', 'query'],
        comparison_operator: 'contains',
        value: 'kronos',
      }],
    })

    expect(config.cases).toHaveLength(1)
    expect(config.cases[0].case_id).toBe('true')
    expect(config.cases[0].logical_operator).toBe('or')
    expect(config.cases[0].conditions[0].variableSelector).toEqual(['sys', 'query'])
    expect(config.cases[0].conditions[0].comparisonOperator).toBe('contains')
  })

  it('rebuilds branch metadata with ELSE fixed at the end', () => {
    const branches = buildIfElseTargetBranches([
      { case_id: 'true', logical_operator: 'and', conditions: [] },
      { case_id: 'case-2', logical_operator: 'and', conditions: [] },
    ])

    expect(branches).toEqual([
      { id: 'true', name: 'IF' },
      { id: 'case-2', name: 'ELIF 1' },
      { id: ELSE_BRANCH_ID, name: 'ELSE' },
    ])
  })

  it('validates missing variable selector and missing comparison value', () => {
    const issues = validateIfElseNodeConfig({
      cases: [{
        case_id: 'true',
        logical_operator: 'and',
        conditions: [{
          id: 'condition-1',
          variableSelector: [],
          variableType: 'string',
          comparisonOperator: 'contains',
          value: '',
        }],
      }],
      isInIteration: false,
      isInLoop: false,
    })

    expect(issues.map(issue => issue.path)).toEqual([
      'cases.0.conditions.0.variableSelector',
      'cases.0.conditions.0.value',
    ])
  })

  it('treats empty-check operators as valueless operators', () => {
    expect(comparisonOperatorRequiresValue('is_empty')).toBe(false)
    expect(comparisonOperatorRequiresValue('is_not_empty')).toBe(false)
    expect(comparisonOperatorRequiresValue('is')).toBe(true)
  })
})