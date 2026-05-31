import { listWorkflowExampleApps } from './workflowExampleStore.js';

export type WorkflowDatasetUsage = {
  appId: string;
  appName: string;
};

const appendDatasetIds = (target: Set<string>, raw: unknown): void => {
  if (!Array.isArray(raw)) {
    return;
  }
  for (const id of raw) {
    if (typeof id === 'string' && id.trim()) {
      target.add(id.trim());
    }
  }
};

/** 从工作流应用 DSL / Chatbot 编排收集引用的知识库 id */
export const collectDatasetIdsFromWorkflowApp = (app: {
  chatbotOrchestration?: { datasetIds?: unknown };
  dsl?: { workflow?: { graph?: { nodes?: unknown[] } } };
}): string[] => {
  const ids = new Set<string>();
  appendDatasetIds(ids, app.chatbotOrchestration?.datasetIds);

  const nodes = app.dsl?.workflow?.graph?.nodes;
  if (!Array.isArray(nodes)) {
    return [...ids];
  }

  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      continue;
    }
    const data = (node as { data?: unknown }).data;
    if (!data || typeof data !== 'object') {
      continue;
    }
    const record = data as Record<string, unknown>;
    appendDatasetIds(ids, record.dataset_ids);
    if (record.inputs && typeof record.inputs === 'object') {
      appendDatasetIds(ids, (record.inputs as Record<string, unknown>).dataset_ids);
    }
  }

  return [...ids];
};

export const findWorkflowExampleAppsUsingDataset = async (
  datasetId: string,
): Promise<WorkflowDatasetUsage[]> => {
  const apps = await listWorkflowExampleApps();
  return apps
    .filter((app) => collectDatasetIdsFromWorkflowApp(app).includes(datasetId))
    .map((app) => ({ appId: app.id, appName: app.name }));
};

export class KnowledgeDatasetInUseByWorkflowError extends Error {
  readonly usages: WorkflowDatasetUsage[];

  constructor(usages: WorkflowDatasetUsage[]) {
    super('KNOWLEDGE_DATASET_IN_USE_BY_WORKFLOW');
    this.name = 'KnowledgeDatasetInUseByWorkflowError';
    this.usages = usages;
  }
}

export const assertKnowledgeDatasetNotUsedByWorkflow = async (datasetId: string): Promise<void> => {
  const usages = await findWorkflowExampleAppsUsingDataset(datasetId);
  if (usages.length > 0) {
    throw new KnowledgeDatasetInUseByWorkflowError(usages);
  }
};
