import { buildWorkflowNodeSummary } from './workflow-node-summary'
import type { CanvasNodeData } from '../types/canvas'

const createNodeData = (
  kind: CanvasNodeData['kind'],
  overrides: Partial<CanvasNodeData> = {},
): CanvasNodeData => ({
  kind,
  title: kind,
  subtitle: kind,
  selected: false,
  ...overrides,
})

describe('workflow node summary', () => {
  it('builds start node input summaries', () => {
    const summary = buildWorkflowNodeSummary(createNodeData('trigger', {
      inputs: {
        variables: [
          {
            id: 'city',
            variable: 'city',
            label: 'city',
            type: 'text-input',
            required: true,
            options: [],
            placeholder: '',
            hint: '',
          },
        ],
      },
    }))

    expect(summary.tags.map(tag => tag.text)).toEqual([])
    expect(summary.items[0]).toMatchObject({
      primary: 'city · Text',
      meta: '必填',
    })
  })

  it('builds llm model and prompt summaries', () => {
    const summary = buildWorkflowNodeSummary(createNodeData('llm', {
      inputs: {
        model: {
          provider: 'virtual',
          name: 'zhiling',
          mode: 'chat',
          completionParams: {},
        },
        promptTemplate: [{ id: '1', role: 'system', text: '请总结用户输入' }],
        context: {
          enabled: true,
          variableSelector: ['sys', 'query'],
        },
        vision: {
          enabled: false,
        },
      },
    }))

    expect(summary.tags.map(tag => tag.text)).toEqual(['智灵', 'CHAT'])
    expect(summary.items[0]?.primary).toBe('Prompt 已配置')
    expect(summary.items[1]?.primary).toContain('上下文 sys.query')
  })

  it('builds knowledge retrieval summaries', () => {
    const summary = buildWorkflowNodeSummary(createNodeData('knowledge', {
      inputs: {
        query_variable_selector: ['sys', 'query'],
        dataset_ids: ['dataset-1', 'dataset-2'],
        retrieval_mode: 'multiWay',
        multiple_retrieval_config: {
          top_k: 5,
          score_threshold: null,
          reranking_enable: false,
          reranking_model: 'default-rerank',
        },
        single_retrieval_config: {
          model: 'default-vector',
          top_k: 3,
          score_threshold: null,
        },
      },
      _datasets: [
        {
          id: 'dataset-1',
          name: 'AI 机遇分析',
          description: '',
          is_multimodal: false,
          doc_metadata: [],
        },
        {
          id: 'dataset-2',
          name: '行业资料',
          description: '',
          is_multimodal: false,
          doc_metadata: [],
        },
      ],
    }))

    expect(summary.tags.map(tag => tag.text)).toEqual(['多路召回', '2 个知识库'])
    expect(summary.items[0]?.primary).toBe('查询 sys.query')
    expect(summary.items[1]?.primary).toBe('知识库 AI 机遇分析 +1')
  })

  it('builds end node output summaries', () => {
    const summary = buildWorkflowNodeSummary(createNodeData('end', {
      inputs: {
        outputs: [
          {
            id: 'out-1',
            variable: 'result',
            value_selector: ['llm-1', 'text'],
            variable_type: 'variable',
            value: '',
            constant_type: 'string',
          },
        ],
      },
      outputs: {
        result: '',
      },
    }))

    expect(summary.tags.map(tag => tag.text)).toEqual(['1 个输出字段'])
    expect(summary.items[0]).toMatchObject({
      primary: 'result · 变量 llm-1.text',
      meta: '变量',
    })
  })
})