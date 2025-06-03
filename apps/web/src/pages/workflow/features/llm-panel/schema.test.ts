import { filterCompletionParamsByModel, MODEL_CATALOG, reconcileVisionConfig } from './catalog'
import {
  createDefaultLLMNodeConfig,
  createPromptTemplateForMode,
  normalizeLLMNodeConfig,
  validateLLMNodeConfig,
} from './schema'

describe('llm-panel schema', () => {
  it('creates a valid default config shell', () => {
    const config = createDefaultLLMNodeConfig()

    expect(config.model.provider).toBe('virtual')
    expect(config.model.name).toBe('zhiling')
    expect(config.model.mode).toBe('chat')
    expect(config.model.completionParams).toEqual({
      temperature: 0.7,
      topP: 1,
      topK: 1,
      maxTokens: 1024,
    })
    expect(Array.isArray(config.promptTemplate)).toBe(true)
    expect(config.context.enabled).toBe(false)
    expect(config.vision.enabled).toBe(false)
  })

  it('normalizes malformed payloads back to defaults', () => {
    const config = normalizeLLMNodeConfig({
      model: { provider: 'openai', mode: 'completion' },
      promptTemplate: [],
      context: { enabled: true },
    })

    expect(config.model.mode).toBe('completion')
    expect(config.model.provider).toBe('virtual')
    expect(config.model.name).toBe('zhiling')
    expect(config.model.completionParams).toEqual({
      temperature: 0.7,
      topP: 1,
      topK: 1,
      maxTokens: 1024,
    })
    expect(Array.isArray(config.promptTemplate)).toBe(false)
    expect(config.context.variableSelector).toEqual([])
  })

  it('migrates unknown model identifiers onto the virtual model without dropping completion mode', () => {
    const config = normalizeLLMNodeConfig({
      model: {
        provider: 'openai',
        name: 'gpt-4.1-mini',
        mode: 'completion',
      },
      promptTemplate: { text: 'legacy completion prompt' },
    })

    expect(config.model.provider).toBe('virtual')
    expect(config.model.name).toBe('zhiling')
    expect(config.model.mode).toBe('completion')
    expect(config.promptTemplate).toEqual({ text: 'legacy completion prompt' })
  })

  it('validates missing model, missing prompt, and invalid memory prompt', () => {
    const config = createDefaultLLMNodeConfig()
    config.model.provider = ''
    config.model.name = ''
    config.memory = {
      window: { enabled: true, size: 20 },
      queryPromptTemplate: 'missing query block',
    }

    const issues = validateLLMNodeConfig(config)
    expect(issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['model', 'memory.queryPromptTemplate']))
  })

  it('creates different prompt templates for chat and completion modes', () => {
    expect(Array.isArray(createPromptTemplateForMode('chat'))).toBe(true)
    expect(Array.isArray(createPromptTemplateForMode('completion'))).toBe(false)
  })
})

describe('llm-panel model migration helpers', () => {
  it('drops unsupported completion params when model changes', () => {
    const result = filterCompletionParamsByModel(
      { temperature: 0.7, maxTokens: 500, topK: 16, presencePenalty: 1 },
      MODEL_CATALOG[0],
    )

    expect(result.params).toEqual({ temperature: 0.7, maxTokens: 500, topK: 16 })
    expect(result.removedKeys).toEqual(['presencePenalty'])
  })

  it('keeps vision config when the virtual model supports it', () => {
    const nextVision = reconcileVisionConfig(
      {
        enabled: true,
        configs: {
          detail: 'high',
          variableSelector: ['sys', 'files'],
        },
      },
      MODEL_CATALOG[0],
    )

    expect(nextVision).toEqual({
      enabled: true,
      configs: {
        detail: 'high',
        variableSelector: ['sys', 'files'],
      },
    })
  })
})