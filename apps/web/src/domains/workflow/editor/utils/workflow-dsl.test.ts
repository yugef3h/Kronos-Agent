import { buildCanvasNodeData } from './workflow-dsl'

describe('workflow-dsl', () => {
  it('normalizes llm node outputs and output types from inputs during hydration', () => {
    const nodeData = buildCanvasNodeData({
      kind: 'llm',
      title: 'LLM',
      subtitle: '模型调用',
      inputs: {
        model: {
          provider: 'virtual',
          name: 'zhiling',
          mode: 'chat',
          completionParams: {
            temperature: 0.7,
            topP: 1,
            topK: 1,
            maxTokens: 1024,
          },
        },
        promptTemplate: [],
        context: {
          enabled: false,
          variableSelector: [],
        },
        vision: {
          enabled: false,
        },
        structuredOutputEnabled: true,
      },
      outputs: {},
    })

    expect(nodeData.outputs).toEqual({
      text: '',
      reasoning_content: '',
      usage: {},
      structured_output: {},
    })
    expect((nodeData.inputs as Record<string, unknown>)._outputTypes).toEqual({
      text: 'string',
      reasoning_content: 'string',
      usage: 'object',
      structured_output: 'object',
    })
  })
})