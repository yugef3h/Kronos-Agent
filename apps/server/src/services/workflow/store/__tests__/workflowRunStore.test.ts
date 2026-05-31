import { NodeRunStatus, WorkflowRunStatus } from '../../../types.js'
import { WorkflowRunStore } from '../../../memoryWorkflowRunStore.js'

describe('WorkflowRunStore', () => {
  it('creates and reads a run record', () => {
    const store = new WorkflowRunStore()
    const created = store.create({ appId: 'wf_test' })

    expect(created.appId).toBe('wf_test')
    expect(created.kind).toBe('draft')
    expect(created.status).toBe(WorkflowRunStatus.Queued)

    const loaded = store.get(created.runId)
    expect(loaded?.runId).toBe(created.runId)
  })

  it('updates status and error fields', () => {
    const store = new WorkflowRunStore()
    const created = store.create({ appId: 'wf_test', status: WorkflowRunStatus.Running })

    const updated = store.update(created.runId, {
      status: WorkflowRunStatus.Failed,
      finishedAt: Date.now(),
      error: { code: 'test', message: 'boom' },
    })

    expect(updated?.status).toBe(WorkflowRunStatus.Failed)
    expect(updated?.error?.message).toBe('boom')
  })

  it('deletes a run record', () => {
    const store = new WorkflowRunStore()
    const created = store.create({ appId: 'wf_test' })

    expect(store.delete(created.runId)).toBe(true)
    expect(store.get(created.runId)).toBeUndefined()
  })

  it('prunes expired runs by ttl', () => {
    const store = new WorkflowRunStore()
    const created = store.create({ appId: 'wf_test', ttlMs: 1 })

    expect(store.size()).toBe(1)

    const removed = store.pruneExpired(Date.now() + 5)
    expect(removed).toBe(1)
    expect(store.get(created.runId)).toBeUndefined()
  })

  it('lists runs for a single app id', () => {
    const store = new WorkflowRunStore()
    store.create({ appId: 'wf_a' })
    store.create({ appId: 'wf_b' })

    expect(store.listByAppId('wf_a')).toHaveLength(1)
  })

  it('persists node debug run snapshots', () => {
    const store = new WorkflowRunStore()
    const saved = store.saveNodeDebugRun({
      appId: 'wf_test',
      request: {
        node: { id: 'start-1', type: 'start' },
        inputs: { query: 'hi' },
      },
      result: {
        nodeId: 'start-1',
        status: NodeRunStatus.Succeeded,
        startedAt: 100,
        finishedAt: 150,
        elapsedMs: 50,
        outputs: { query: 'hi' },
      },
    })

    expect(saved.kind).toBe('node_debug')
    expect(saved.status).toBe(WorkflowRunStatus.Succeeded)
    expect(saved.nodeDebug?.nodeType).toBe('start')
    expect(saved.nodeDebug?.outputs).toEqual({ query: 'hi' })

    const loaded = store.get(saved.runId)
    expect(loaded?.nodeDebug?.nodeId).toBe('start-1')
  })
})
