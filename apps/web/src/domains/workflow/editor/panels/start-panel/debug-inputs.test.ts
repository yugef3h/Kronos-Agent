import { buildStartPanelDebugInputs } from './debug-inputs'

describe('buildStartPanelDebugInputs', () => {
  it('maps query and custom variables', () => {
    const inputs = buildStartPanelDebugInputs(
      {
        variables: [
          {
            id: '1',
            variable: 'topic',
            label: '主题',
            type: 'text-input',
            required: true,
            options: [],
            placeholder: '',
            hint: '',
          },
        ],
      },
      {
        query: 'hello',
        topic: 'RAG',
      },
    )

    expect(inputs).toEqual({
      query: 'hello',
      topic: 'RAG',
    })
  })

  it('coerces number and checkbox values', () => {
    const inputs = buildStartPanelDebugInputs(
      {
        variables: [
          {
            id: '1',
            variable: 'count',
            label: '数量',
            type: 'number',
            required: false,
            options: [],
            placeholder: '',
            hint: '',
          },
          {
            id: '2',
            variable: 'enabled',
            label: '启用',
            type: 'checkbox',
            required: false,
            options: [],
            placeholder: '',
            hint: '',
          },
        ],
      },
      {
        query: '',
        count: '3',
        enabled: 'true',
      },
    )

    expect(inputs.count).toBe(3)
    expect(inputs.enabled).toBe(true)
  })
})
