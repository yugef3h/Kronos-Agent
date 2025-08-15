import {
  createDefaultKnowledgeRetrievalNodeConfig,
  getKnowledgeMetadataFieldsIntersection,
  normalizeKnowledgeRetrievalNodeConfig,
  shouldShowKnowledgeAttachmentSelector,
  validateKnowledgeRetrievalNodeConfig,
} from './schema'

const TEST_DATASETS = [
  {
    id: 'dataset-a',
    name: '数据集 A',
    description: '',
    is_multimodal: false,
    doc_metadata: [
      { key: 'category', label: '分类' },
      { key: 'language', label: '语言' },
      { key: 'channel', label: '渠道' },
    ],
  },
  {
    id: 'dataset-b',
    name: '数据集 B',
    description: '',
    is_multimodal: false,
    doc_metadata: [
      { key: 'category', label: '分类' },
      { key: 'language', label: '语言' },
      { key: 'channel', label: '渠道' },
    ],
  },
  {
    id: 'dataset-c',
    name: '数据集 C',
    description: '',
    is_multimodal: true,
    doc_metadata: [
      { key: 'category', label: '分类' },
      { key: 'language', label: '语言' },
      { key: 'brand', label: '品牌' },
    ],
  },
]

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
      dataset_ids: ['dataset-a'],
      retrieval_mode: 'oneWay',
    })

    expect(config.retrieval_mode).toBe('oneWay')
    expect(config.query_attachment_selector).toEqual([])
  })

  it('detects multimodal datasets and exposes the attachment selector', () => {
    expect(shouldShowKnowledgeAttachmentSelector(['dataset-c'], TEST_DATASETS)).toBe(true)
    expect(shouldShowKnowledgeAttachmentSelector(['dataset-a'], TEST_DATASETS)).toBe(false)
  })

  it('returns the metadata intersection across selected datasets', () => {
    const fields = getKnowledgeMetadataFieldsIntersection(['dataset-a', 'dataset-b'], TEST_DATASETS)

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