import { describe, expect, it, jest } from '@jest/globals';
import { saveWorkflowExampleApp } from './workflowExampleStore.js';

describe('workflowExampleStore readonly', () => {
  it('rejects save when WORKFLOW_EXAMPLES_WRITABLE is unset', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const previous = process.env.WORKFLOW_EXAMPLES_WRITABLE;

    try {
      delete process.env.WORKFLOW_EXAMPLES_WRITABLE;

      const result = await saveWorkflowExampleApp({
        id: 'wf_mnvxgxnf_73oerm',
        name: 'test',
        description: '',
        createdAt: 1,
        updatedAt: 2,
        dsl: { workflow: { graph: { nodes: [], edges: [] } } },
      });

      expect(result).toEqual({ ok: false, code: 'readonly' });
    } finally {
      if (previous === undefined) {
        delete process.env.WORKFLOW_EXAMPLES_WRITABLE;
      } else {
        process.env.WORKFLOW_EXAMPLES_WRITABLE = previous;
      }
      warnSpy.mockRestore();
    }
  });
});
