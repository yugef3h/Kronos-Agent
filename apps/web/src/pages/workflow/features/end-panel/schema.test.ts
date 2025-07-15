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
        { id: '1', variable: 'answer', value_selector: ['sys', 'query'], variable_type: 'variable', value: '' },
        { id: '2', variable: 'answer', value_selector: ['sys', 'files'], variable_type: 'variable', value: '' },
      ],
    })

    expect(issues.length).toBeGreaterThan(0)
  })

  it('builds result output values from config', () => {
    expect(buildEndNodeOutputs({
      outputs: [
        { id: '1', variable: 'answer', value_selector: ['sys', 'query'], variable_type: 'variable', value: '' },
        { id: '2', variable: 'summary', value_selector: [], variable_type: 'constant', value: 'ok' },
      ],
    })).toEqual({
      answer: '',
      summary: 'ok',
    })
  })
})