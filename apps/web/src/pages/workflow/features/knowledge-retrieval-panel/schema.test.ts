import {
  createDefaultKnowledgeRetrievalNodeConfig,
  getKnowledgeMetadataFieldsIntersection,
  normalizeKnowledgeRetrievalNodeConfig,
  shouldShowKnowledgeAttachmentSelector,
  validateKnowledgeRetrievalNodeConfig,
} from './schema'

describe('knowledge-retrieval-panel schema', () => {
  it('creates a valid default config shell', () => {
    const config = createDefaultKnowledgeRetrievalNodeConfig()

    expect(config.query_variable_selector).toEqual(['sys', 'query'])
    expect(config.dataset_ids).toEqual([])
    expect(config.retrieval_mode).toBe('multiWay')
    expect(config.metadata_filtering_conditions).toEqual([])
  })

  it('normalizes invalid inputs and clears attachment selector when datasets are not multimodal', () => {
    const config = normalizeKnowledgeRetrievalNodeConfig({
      query_variable_selector: ['sys', 'query'],
      query_attachment_selector: ['sys', 'files'],
      dataset_ids: ['support-center'],
      retrieval_mode: 'oneWay',
    })

    expect(config.retrieval_mode).toBe('oneWay')
    expect(config.query_attachment_selector).toEqual([])
  })

  it('detects multimodal datasets and exposes the attachment selector', () => {
    expect(shouldShowKnowledgeAttachmentSelector(['catalog-gallery'])).toBe(true)
    expect(shouldShowKnowledgeAttachmentSelector(['support-center'])).toBe(false)
  })

  it('returns the metadata intersection across selected datasets', () => {
    const fields = getKnowledgeMetadataFieldsIntersection(['support-center', 'operations-manual'])

    expect(fields.map(field => field.key)).toEqual(['category', 'language', 'channel'])
  })

  it('validates missing datasets and incomplete metadata conditions', () => {
    const issues = validateKnowledgeRetrievalNodeConfig({
      ...createDefaultKnowledgeRetrievalNodeConfig(),
      metadata_filtering_mode: 'manual',
      metadata_filtering_conditions: [{
        id: 'condition-1',
        field: '',
        operator: 'contains',
        value: '',
      }],
    })

    expect(issues.map(issue => issue.path)).toEqual([
      'dataset_ids',
      'metadata_filtering_conditions',
      'metadata_filtering_conditions.0.field',
      'metadata_filtering_conditions.0.value',
    ])
  })
})