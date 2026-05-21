import type { CanvasNodeData } from '../types/canvas'
import type { Node } from 'reactflow'
import { resolveStartDraftTestRun } from './resolve-start-draft-test-run'

const createTriggerNode = (
  inputs: Record<string, unknown>,
  panelDebugDraft?: Record<string, unknown>,
): Node<CanvasNodeData> => ({
  id: 'start-1',
  type: 'custom',
  position: { x: 0, y: 0 },
  data: {
    kind: 'trigger',
    inputs,
    ...(panelDebugDraft ? { _panelDebugDraft: panelDebugDraft } : {}),
  } as CanvasNodeData,
})

describe('resolveStartDraftTestRun', () => {
  it('is not ready when query is missing', () => {
    const result = resolveStartDraftTestRun({
      triggerNode: createTriggerNode({ variables: [] }),
    })

    expect(result.ready).toBe(false)
    expect(result.issues).toContain('请填写用户问题 (query)。')
  })

  it('is ready when persisted debug draft satisfies required fields', () => {
    const result = resolveStartDraftTestRun({
      triggerNode: createTriggerNode(
        {
          variables: [
            {
              id: '1',
              variable: 'topic',
              label: '主题',
              type: 'text-input',
              required: true,
              options: [],
              placeholder: '',
              hint: '',
            },
          ],
        },
        {
          query: 'hello',
          topic: 'RAG',
        },
      ),
    })

    expect(result.ready).toBe(true)
    expect(result.inputs).toEqual({
      query: 'hello',
      topic: 'RAG',
    })
  })
})
