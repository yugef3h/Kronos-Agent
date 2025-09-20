import { buildKnowledgeDatasetPagePath } from './navigation'

describe('buildKnowledgeDatasetPagePath', () => {
  it('returns rag root path when no dataset id is provided', () => {
    expect(buildKnowledgeDatasetPagePath()).toBe('/rag')
    expect(buildKnowledgeDatasetPagePath('   ')).toBe('/rag')
  })

  it('includes the dataset query parameter when an id is provided', () => {
    expect(buildKnowledgeDatasetPagePath('dataset_123')).toBe('/rag?dataset=dataset_123')
    expect(buildKnowledgeDatasetPagePath(' dataset with space ')).toBe('/rag?dataset=dataset%20with%20space')
  })
})