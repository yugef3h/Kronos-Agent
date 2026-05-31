import { RunContext, normalizeVariableSelector } from './runContext.js'

describe('RunContext', () => {
  it('normalizes dotted selectors', () => {
    expect(normalizeVariableSelector('sys.query')).toEqual(['sys', 'query'])
  })

  it('resolves sys and node output selectors', () => {
    const context = new RunContext({
      runId: 'run_test',
      appId: 'wf_test',
      inputs: { query: 'hello' },
    })

    context.setNodeOutputs('llm-1', {
      text: 'world',
      nested: { score: 0.9 },
    })

    expect(context.resolve(['sys', 'query'])).toBe('hello')
    expect(context.resolve(['llm-1', 'text'])).toBe('world')
    expect(context.resolve(['llm-1', 'nested', 'score'])).toBe(0.9)
    expect(context.get('llm-1.nested.score')).toBe(0.9)
  })

  it('supports set and container stack helpers', () => {
    const context = new RunContext({
      runId: 'run_test',
      appId: 'wf_test',
    })

    context.set(['sys', 'files'], [])
    context.set(['start-1', 'topic'], 'RAG')
    context.pushContainer({ kind: 'loop', nodeId: 'loop-1', index: 0 })

    expect(context.resolve(['sys', 'files'])).toEqual([])
    expect(context.resolve(['start-1', 'topic'])).toBe('RAG')
    expect(context.containerStack).toHaveLength(1)
    expect(context.popContainer()?.index).toBe(0)
  })
})
