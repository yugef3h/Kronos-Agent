import { appendTagItems, normalizeTagInput } from './tag-input-utils'

describe('tag-input-utils', () => {
  it('normalizes whitespace inside a tag', () => {
    expect(normalizeTagInput('  multi   agent  ')).toBe('multi agent')
  })

  it('appends deduplicated tags from comma and newline separated input', () => {
    expect(appendTagItems(['知识库'], 'RAG, rag\nAgent，知识库')).toEqual([
      '知识库',
      'RAG',
      'Agent',
    ])
  })
})