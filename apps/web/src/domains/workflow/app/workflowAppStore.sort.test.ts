import { sortWorkflowAppsByCreatedAt, type WorkflowAppRecord } from './workflowAppStore';

const app = (id: string, createdAt: number, updatedAt: number): WorkflowAppRecord =>
  ({
    id,
    name: id,
    description: '',
    createdAt,
    updatedAt,
    dsl: {
      app: {
        description: '',
        icon: '🤖',
        icon_background: '#FFEAD5',
        icon_type: 'emoji',
        mode: 'workflow',
        name: id,
        use_icon_as_answer_icon: false,
      },
      dependencies: [],
      kind: 'app',
      version: '0.6.0',
      workflow: {
        conversation_variables: [],
        environment_variables: [],
        features: {} as WorkflowAppRecord['dsl']['workflow']['features'],
        graph: { edges: [], nodes: [] },
        rag_pipeline_variables: [],
      },
    },
  }) as WorkflowAppRecord;

describe('sortWorkflowAppsByCreatedAt', () => {
  it('orders by createdAt ascending regardless of updatedAt', () => {
    const sorted = sortWorkflowAppsByCreatedAt([
      app('b', 200, 900),
      app('a', 100, 50),
      app('c', 300, 100),
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });
});
