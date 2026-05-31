import { NodeRunStatus } from '../../types.js'
import type { NodeDebugRequest } from '../../types.js'
import {
  NodeDebugExecutorNotFoundError,
  NodeDebugExecutorRegistry,
} from '../../nodeDebugExecutors.js'

const createRequest = (type: NodeDebugRequest['node']['type']): NodeDebugRequest => ({
  appId: 'wf_test',
  node: {
    id: 'node-1',
    type,
    inputs: { query: 'hello' },
  },
  inputs: { query: 'hello' },
})

describe('NodeDebugExecutorRegistry', () => {
  it('registers and executes a node debug executor', async () => {
    const registry = new NodeDebugExecutorRegistry()

    registry.register('start', async (request) => ({
      nodeId: request.node.id,
      status: NodeRunStatus.Succeeded,
      startedAt: Date.now(),
      finishedAt: Date.now(),
      elapsedMs: 1,
      outputs: { ok: true },
    }))

    const result = await registry.execute(createRequest('start'))
    expect(result.status).toBe(NodeRunStatus.Succeeded)
    expect(result.outputs).toEqual({ ok: true })
  })

  it('throws when executor is missing', async () => {
    const registry = new NodeDebugExecutorRegistry()

    await expect(registry.execute(createRequest('llm'))).rejects.toBeInstanceOf(
      NodeDebugExecutorNotFoundError,
    )
  })
})
