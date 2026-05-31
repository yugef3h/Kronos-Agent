import { NodeRunStatus } from '../../../types.js'
import {
  executeLlmNodeDebug,
  interpolateWorkflowPrompt,
  normalizeLLMNodeConfig,
  validateLLMNodeConfig,
} from '../../../llmNodeDebugExecutor.js'

describe('llmNodeDebugExecutor', () => {
  it('interpolates workflow variable placeholders', () => {
    const rendered = interpolateWorkflowPrompt(
      '请回答：{{#sys.query#}}，上下文：{{#trigger-1.topic#}}',
      {
        'sys.query': '什么是 RAG',
        'trigger-1': { topic: 'AI' },
      },
    )

    expect(rendered).toBe('请回答：什么是 RAG，上下文：AI')
  })

  it('normalizes draft DSL snake_case prompt_template', () => {
    const config = normalizeLLMNodeConfig({
      model: {
        provider: 'virtual',
        name: 'zhiling',
        mode: 'chat',
        completion_params: { temperature: 0.7, top_p: 1, top_k: 1, max_tokens: 1024 },
      },
      prompt_template: [{ id: 'p1', role: 'user', text: '请回答：{{#sys.query#}}' }],
      context: { enabled: false, variable_selector: [] },
      structured_output_enabled: false,
    })

    expect(validateLLMNodeConfig(config)).toEqual([])
    expect((config.promptTemplate as Array<{ text: string }>)[0]?.text).toBe('请回答：{{#sys.query#}}')
  })

  it('fails when prompt is empty', async () => {
    const configIssues = validateLLMNodeConfig({
      model: {
        provider: 'virtual',
        name: 'zhiling',
        mode: 'chat',
        completionParams: { temperature: 0.7, topP: 1, topK: 1, maxTokens: 1024 },
      },
      promptTemplate: [{ id: 'p1', role: 'system', text: '   ' }],
      context: { enabled: false, variableSelector: [] },
      structuredOutputEnabled: false,
    })

    expect(configIssues.some((issue) => issue.path === 'promptTemplate')).toBe(true)

    const result = await executeLlmNodeDebug({
      node: {
        id: 'llm-1',
        type: 'llm',
        inputs: {
          model: { provider: 'virtual', name: 'zhiling', mode: 'chat' },
          promptTemplate: [{ id: 'p1', role: 'system', text: '' }],
        },
      },
    })

    expect(result.status).toBe(NodeRunStatus.Failed)
    expect(result.error?.code).toBe('llm_config_invalid')
  })
})
