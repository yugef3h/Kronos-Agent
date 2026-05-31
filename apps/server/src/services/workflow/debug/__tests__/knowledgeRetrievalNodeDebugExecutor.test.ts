import { NodeRunStatus } from '../../../types.js'

const mockRunKnowledgeRetrievalQuery = jest.fn()

jest.mock('../../rag/knowledgeFacade.js', () => ({
  runKnowledgeRetrievalQuery: (...args: unknown[]) => mockRunKnowledgeRetrievalQuery(...args),
}))

import {
  executeKnowledgeRetrievalNodeDebug,
  resolveKnowledgeDebugQuery,
} from '../../../knowledgeRetrievalNodeDebugExecutor.js'

describe('knowledgeRetrievalNodeDebugExecutor', () => {
  beforeEach(() => {
    mockRunKnowledgeRetrievalQuery.mockReset()
  })

  it('prefers explicit debug query input', () => {
    const query = resolveKnowledgeDebugQuery(
      {
        query_variable_selector: ['sys', 'query'],
        query_attachment_selector: [],
        dataset_ids: ['ds-1'],
        retrieval_mode: 'multiWay',
        single_retrieval_config: { model: 'default-vector', top_k: 3, score_threshold: null },
        multiple_retrieval_config: {
          top_k: 5,
          score_threshold: null,
          reranking_enable: false,
          reranking_model: 'default-rerank',
        },
      },
      {
        node: { id: 'knowledge-1', type: 'knowledge-retrieval' },
        inputs: { query: '什么是 RAG' },
      },
    )

    expect(query).toBe('什么是 RAG')
  })

  it('allows explicit debug query without query_variable_selector', async () => {
    mockRunKnowledgeRetrievalQuery.mockResolvedValue({
      query: 'test',
      items: [],
      diagnostics: {
        retrieval_mode: 'multiWay',
        dataset_count: 1,
        total_chunk_count: 0,
        filtered_chunk_count: 0,
      },
    })

    const result = await executeKnowledgeRetrievalNodeDebug({
      node: {
        id: 'knowledge-1',
        type: 'knowledge-retrieval',
        inputs: {
          dataset_ids: ['ds-1'],
          query_variable_selector: [],
          retrieval_mode: 'multiWay',
        },
      },
      inputs: { query: 'test' },
    })

    expect(result.status).toBe(NodeRunStatus.Succeeded)
    expect(mockRunKnowledgeRetrievalQuery).toHaveBeenCalled()
  })

  it('executes knowledge retrieval query via facade', async () => {
    mockRunKnowledgeRetrievalQuery.mockResolvedValue({
      query: '什么是 RAG',
      items: [{
        dataset_id: 'ds-1',
        dataset_name: '知识库',
        document_id: 'doc-1',
        document_name: 'doc.txt',
        chunk_id: 'chunk-1',
        chunk_index: 0,
        text: 'RAG 是检索增强生成',
        score: 0.9,
        search_method: 'semantic_search',
        matched_terms: ['RAG'],
        metadata: {},
        token_count: 10,
        char_count: 20,
      }],
      diagnostics: {
        retrieval_mode: 'multiWay',
        dataset_count: 1,
        total_chunk_count: 1,
        filtered_chunk_count: 1,
      },
    })

    const result = await executeKnowledgeRetrievalNodeDebug({
      node: {
        id: 'knowledge-1',
        type: 'knowledge-retrieval',
        inputs: {
          dataset_ids: ['ds-1'],
          query_variable_selector: ['sys', 'query'],
          retrieval_mode: 'multiWay',
        },
      },
      inputs: { query: '什么是 RAG' },
    })

    expect(result.status).toBe(NodeRunStatus.Succeeded)
    expect(mockRunKnowledgeRetrievalQuery).toHaveBeenCalledWith({
      query: '什么是 RAG',
      dataset_ids: ['ds-1'],
      retrieval_mode: 'multiWay',
      single_retrieval_config: expect.objectContaining({ model: 'default-vector' }),
      multiple_retrieval_config: expect.objectContaining({ top_k: 5 }),
      metadata_filtering_mode: 'disabled',
      metadata_filtering_conditions: [],
    })
    expect(result.outputs?.result).toHaveLength(1)
  })
})
