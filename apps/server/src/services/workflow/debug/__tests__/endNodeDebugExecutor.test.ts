import { NodeRunStatus } from '../../../types.js'
import { executeEndNodeDebug } from '../../../endNodeDebugExecutor.js'

describe('executeEndNodeDebug', () => {
  it('resolves constant outputs', async () => {
    const result = await executeEndNodeDebug({
      node: {
        id: 'end-1',
        type: 'end',
        inputs: {
          outputs: [
            {
              id: 'out-1',
              variable: 'result',
              variable_type: 'constant',
              value: 'done',
              constant_type: 'string',
              value_selector: [],
            },
          ],
        },
      },
    })

    expect(result.status).toBe(NodeRunStatus.Succeeded)
    expect(result.outputs?.result).toBe('done')
  })

  it('resolves selector outputs from mock context', async () => {
    const result = await executeEndNodeDebug({
      node: {
        id: 'end-1',
        type: 'end',
        inputs: {
          outputs: [
            {
              id: 'out-1',
              variable: 'answer',
              variable_type: 'variable',
              value_selector: ['llm-1', 'text'],
              value: '',
              constant_type: 'string',
            },
          ],
        },
      },
      context: {
        variables: {
          'llm-1': {
            text: 'hello world',
          },
        },
      },
    })

    expect(result.status).toBe(NodeRunStatus.Succeeded)
    expect(result.outputs?.answer).toBe('hello world')
  })

  it('uses mock placeholder when context is missing', async () => {
    const result = await executeEndNodeDebug({
      node: {
        id: 'end-1',
        type: 'end',
        inputs: {
          outputs: [
            {
              id: 'out-1',
              variable: 'answer',
              variable_type: 'variable',
              value_selector: ['llm-1', 'text'],
              value: '',
              constant_type: 'string',
            },
          ],
        },
      },
    })

    expect(result.status).toBe(NodeRunStatus.Succeeded)
    expect(result.outputs?.answer).toBe('[mock:llm-1.text]')
    expect((result.outputs?._debug as { usedMockContext?: boolean })?.usedMockContext).toBe(true)
  })
})
