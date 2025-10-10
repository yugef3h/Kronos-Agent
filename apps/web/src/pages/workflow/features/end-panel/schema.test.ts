import {
  buildEndNodeOutputs,
  normalizeEndNodeConfig,
  validateEndNodeConfig,
} from './schema'

describe('end-panel schema', () => {
  it('creates a fallback result output when no persisted config exists', () => {
    const config = normalizeEndNodeConfig(null, { result: '' })

    expect(config.outputs).toHaveLength(1)
    expect(config.outputs[0].variable).toBe('result')
  })

  it('validates duplicate output variable names', () => {
    const issues = validateEndNodeConfig({
      outputs: [
        { id: '1', variable: 'answer', value_selector: ['sys', 'query'], variable_type: 'variable', constant_type: 'string', value: '' },
        { id: '2', variable: 'answer', value_selector: ['sys', 'files'], variable_type: 'variable', constant_type: 'string', value: '' },
      ],
    })

    expect(issues.length).toBeGreaterThan(0)
  })

  it('builds result output values from config', () => {
    expect(buildEndNodeOutputs({
      outputs: [
        { id: '1', variable: 'answer', value_selector: ['sys', 'query'], variable_type: 'variable', constant_type: 'string', value: '' },
        { id: '2', variable: 'summary', value_selector: [], variable_type: 'constant', constant_type: 'string', value: 'ok' },
        { id: '3', variable: 'count', value_selector: [], variable_type: 'constant', constant_type: 'number', value: '3' },
        { id: '4', variable: 'done', value_selector: [], variable_type: 'constant', constant_type: 'boolean', value: 'true' },
      ],
    })).toEqual({
      answer: '',
      summary: 'ok',
      count: 3,
      done: true,
    })
  })

  it('validates malformed json constants', () => {
    const issues = validateEndNodeConfig({
      outputs: [
        { id: '1', variable: 'payload', value_selector: [], variable_type: 'constant', constant_type: 'json', value: '{bad json}' },
      ],
    })

    expect(issues.map(issue => issue.path)).toContain('outputs.0.value')
  })

  it('requires at least one output definition', () => {
    const issues = validateEndNodeConfig({ outputs: [] })
    expect(issues.map(issue => issue.path)).toContain('outputs')
  })
})
