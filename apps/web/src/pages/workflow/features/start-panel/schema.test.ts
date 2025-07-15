import {
  buildStartNodeOutputs,
  normalizeStartNodeConfig,
  validateStartNodeConfig,
} from './schema'

describe('start-panel schema', () => {
  it('normalizes malformed payloads to an empty config', () => {
    expect(normalizeStartNodeConfig(null)).toEqual({ variables: [] })
  })

  it('validates duplicate and reserved variable names', () => {
    const issues = validateStartNodeConfig({
      variables: [
        {
          id: 'a',
          variable: 'query',
          label: '用户问题',
          type: 'text-input',
          required: false,
          options: [],
          placeholder: '',
          hint: '',
        },
        {
          id: 'b',
          variable: 'query',
          label: '用户问题 2',
          type: 'text-input',
          required: false,
          options: [],
          placeholder: '',
          hint: '',
        },
      ],
    })

    expect(issues.length).toBeGreaterThan(0)
  })

  it('builds trigger outputs from custom variables while keeping system outputs', () => {
    expect(buildStartNodeOutputs({
      variables: [
        {
          id: 'a',
          variable: 'city',
          label: '城市',
          type: 'text-input',
          required: true,
          options: [],
          placeholder: '',
          hint: '',
        },
      ],
    })).toEqual({
      query: '',
      files: [],
      city: '',
    })
  })
})