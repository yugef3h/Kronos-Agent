import { extractKnowledgeKeywords, normalizeKeywords } from './knowledgeKeywordService'

describe('knowledgeKeywordService', () => {
  it('extracts stable keywords from mixed Chinese and English text', () => {
    const keywords = extractKnowledgeKeywords('RAG 检索增强生成用于知识库问答，RAG 会结合检索结果生成答案。')

    expect(keywords).toContain('RAG')
    expect(keywords).toContain('检索增强生成用于知识库问答')
    expect(keywords).toContain('会结合检索结果生成答案')
  })

  it('deduplicates and trims manually provided keywords', () => {
    expect(normalizeKeywords([' AI ', 'RAG', 'ai', ' 知识库 '])).toEqual(['AI', 'RAG', '知识库'])
  })
})