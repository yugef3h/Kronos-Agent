import { NodeRunStatus } from '../workflow/types.js'
import { registerNodeDebugExecutor } from '../workflow/nodeDebugExecutors.js'
import { executeKnowledgeRetrievalNodeDebug } from '../workflow/debug/knowledgeRetrievalNodeDebugExecutor.js'
import { invokeWorkflowNodeDebugNodePost } from './workflowNodeDebugRoutes.testUtils.js'

const mockRunKnowledgeRetrievalQuery = jest.fn()

jest.mock('../rag/knowledgeFacade.js', () => ({
  runKnowledgeRetrievalQuery: (...args: unknown[]) => mockRunKnowledgeRetrievalQuery(...args),
}))

const postWorkflowNodeDebugKnowledge = async (body: unknown) => {
  registerNodeDebugExecutor('knowledge-retrieval', executeKnowledgeRetrievalNodeDebug)
  return invokeWorkflowNodeDebugNodePost(body)
}

describe('POST /workflow/debug/node (knowledge-retrieval)', () => {
  beforeEach(() => {
    mockRunKnowledgeRetrievalQuery.mockReset()
  })

  it('returns knowledge retrieval debug result', async () => {
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

    const { status, body } = await postWorkflowNodeDebugKnowledge({
      appId: 'wf_test',
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

    expect(status).toBe(200)
    expect(body).toMatchObject({
      result: {
        nodeId: 'knowledge-1',
        status: NodeRunStatus.Succeeded,
        outputs: {
          result: [{ chunk_id: 'chunk-1' }],
        },
      },
    })
    expect(mockRunKnowledgeRetrievalQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '什么是 RAG',
        dataset_ids: ['ds-1'],
      }),
    )
  })

  it('returns failed result when dataset ids are missing', async () => {
    const { status, body } = await postWorkflowNodeDebugKnowledge({
      appId: 'wf_test',
      node: {
        id: 'knowledge-1',
        type: 'knowledge-retrieval',
        inputs: {
          dataset_ids: [],
          query_variable_selector: ['sys', 'query'],
          retrieval_mode: 'multiWay',
        },
      },
      inputs: { query: '什么是 RAG' },
    })

    expect(status).toBe(200)
    expect(body).toMatchObject({
      result: {
        status: NodeRunStatus.Failed,
        error: { code: 'knowledge_config_invalid' },
      },
    })
    expect(mockRunKnowledgeRetrievalQuery).not.toHaveBeenCalled()
  })
})
