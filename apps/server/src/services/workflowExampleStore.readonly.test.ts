import { describe, expect, it } from '@jest/globals';
import { saveWorkflowExampleApp } from './workflowExampleStore.js';

describe('workflowExampleStore readonly', () => {
  it('rejects save when WORKFLOW_EXAMPLES_WRITABLE is unset', async () => {
    const previous = process.env.WORKFLOW_EXAMPLES_WRITABLE;
    delete process.env.WORKFLOW_EXAMPLES_WRITABLE;

    const result = await saveWorkflowExampleApp({
      id: 'wf_mnvxgxnf_73oerm',
      name: 'test',
      description: '',
      createdAt: 1,
      updatedAt: 2,
      dsl: { workflow: { graph: { nodes: [], edges: [] } } },
    });

    if (previous === undefined) {
      delete process.env.WORKFLOW_EXAMPLES_WRITABLE;
    } else {
      process.env.WORKFLOW_EXAMPLES_WRITABLE = previous;
    }

    expect(result).toEqual({ ok: false, code: 'readonly' });
  });
});
