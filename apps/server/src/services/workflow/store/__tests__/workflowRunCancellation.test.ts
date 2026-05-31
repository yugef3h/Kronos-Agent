import { MemoryWorkflowRunCancellation } from '../../memoryWorkflowRunCancellation.js'

describe('MemoryWorkflowRunCancellation', () => {
  it('marks, checks and clears cancellation', async () => {
    const store = new MemoryWorkflowRunCancellation()

    await store.markCancelled('run_test')
    expect(await store.isCancelled('run_test')).toBe(true)

    await store.clear('run_test')
    expect(await store.isCancelled('run_test')).toBe(false)
  })
})
