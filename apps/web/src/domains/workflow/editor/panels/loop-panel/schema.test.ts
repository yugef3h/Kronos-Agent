import {
  buildLoopChildren,
  createDefaultLoopNodeConfig,
  normalizeLoopNodeConfig,
  validateLoopNodeConfig,
} from './schema'

describe('loop-panel schema', () => {
  it('creates a deterministic default loop config', () => {
    const config = createDefaultLoopNodeConfig('loop-1')

    expect(config.start_node_id).toBe('loop-1__loop_start')
    expect(config.loop_count).toBe(10)
    expect(config.logical_operator).toBe('and')
  })

  it('normalizes loop values and clamps invalid loop count', () => {
    const config = normalizeLoopNodeConfig({
      loop_count: 999,
      logical_operator: 'or',
      loop_variables: [{
        label: 'counter',
        var_type: 'number',
        value_type: 'constant',
        value: '4',
      }],
    }, 'loop-2')

    expect(config.loop_count).toBe(100)
    expect(config.logical_operator).toBe('or')
    expect(config.loop_variables[0].value).toBe(4)
  })

  it('builds runtime children and validates duplicates and incomplete conditions', () => {
    expect(buildLoopChildren('loop-3__loop_start')).toEqual([
      {
        nodeId: 'loop-3__loop_start',
        nodeType: 'loop-start',
      },
    ])

    const issues = validateLoopNodeConfig({
      ...createDefaultLoopNodeConfig('loop-3'),
      loop_variables: [
        {
          id: 'var-1',
          label: 'state',
          var_type: 'string',
          value_type: 'constant',
          value: '',
          value_selector: [],
        },
        {
          id: 'var-2',
          label: 'state',
          var_type: 'string',
          value_type: 'variable',
          value: '',
          value_selector: [],
        },
      ],
      break_conditions: [{
        id: 'cond-1',
        variableSelector: [],
        variableType: 'string',
        comparisonOperator: 'contains',
        value: '',
      }],
    })

    expect(issues.map(issue => issue.path)).toEqual([
      'loop_variables.1.label',
      'loop_variables.1.value_selector',
      'break_conditions.0.variableSelector',
      'break_conditions.0.value',
    ])
  })

  it('requires at least one loop variable', () => {
    const issues = validateLoopNodeConfig(createDefaultLoopNodeConfig('loop-4'))
    expect(issues.map(issue => issue.path)).toContain('loop_variables')
  })
})
