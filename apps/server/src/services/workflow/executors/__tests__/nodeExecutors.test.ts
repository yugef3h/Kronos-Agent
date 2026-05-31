import { NodeRunStatus } from '../types.js'
import type { NodeExecutionRequest } from '../nodeExecutors.js'
import {
  NodeExecutorNotFoundError,
  NodeExecutorRegistry,
} from '../nodeExecutors.js'
import { RunContext } from '../runContext.js'

const createRequest = (type: NodeExecutionRequest['node']['type']): NodeExecutionRequest => ({
  runId: 'run_test',
  appId: 'wf_test',
  node: {
    id: 'node-1',
    type,
    inputs: { query: 'hello' },
  },
  context: new RunContext({
    runId: 'run_test',
    appId: 'wf_test',
    inputs: { query: 'hello' },
  }),
})

describe('NodeExecutorRegistry', () => {
  it('registers and executes a workflow node executor', async () => {
    const registry = new NodeExecutorRegistry()

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
    const registry = new NodeExecutorRegistry()

    await expect(registry.execute(createRequest('llm'))).rejects.toBeInstanceOf(
      NodeExecutorNotFoundError,
    )
  })
})
