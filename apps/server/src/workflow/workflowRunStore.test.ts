import { WorkflowRunStatus } from './types.js'
import { WorkflowRunStore } from './workflowRunStore.js'

describe('WorkflowRunStore', () => {
  it('creates and reads a run record', () => {
    const store = new WorkflowRunStore()
    const created = store.create({ appId: 'wf_test' })

    expect(created.appId).toBe('wf_test')
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
})
