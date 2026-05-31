import { NodeRunStatus } from '../types/types.js'
import { executeStartNodeDebug } from '../startNodeDebugExecutor.js'

describe('executeStartNodeDebug', () => {
  it('normalizes start outputs and injects system variables', async () => {
    const result = await executeStartNodeDebug({
      node: {
        id: 'trigger-1',
        type: 'start',
        inputs: {
          variables: [
            {
              id: 'var-1',
              variable: 'topic',
              label: '主题',
              type: 'text-input',
              required: true,
              options: [],
            },
          ],
        },
      },
      inputs: {
        topic: 'RAG',
        query: '什么是 RAG',
      },
    })

    expect(result.status).toBe(NodeRunStatus.Succeeded)
    expect(result.outputs?.topic).toBe('RAG')
    expect(result.outputs?.['sys.query']).toBe('什么是 RAG')
    expect(Array.isArray(result.outputs?.['sys.files'])).toBe(true)
    expect(typeof result.outputs?.['sys.conversation_id']).toBe('string')
  })

  it('fails when required variable is missing', async () => {
    const result = await executeStartNodeDebug({
      node: {
        id: 'trigger-1',
        type: 'start',
        inputs: {
          variables: [
            {
              id: 'var-1',
              variable: 'topic',
              label: '主题',
              type: 'text-input',
              required: true,
              options: [],
            },
          ],
        },
      },
      inputs: {},
    })

    expect(result.status).toBe(NodeRunStatus.Failed)
    expect(result.error?.code).toBe('start_inputs_invalid')
  })
})
