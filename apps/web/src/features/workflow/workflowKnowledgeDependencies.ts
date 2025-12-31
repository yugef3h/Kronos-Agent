import { listWorkflowApps, type WorkflowAppRecord } from './workflowAppStore';

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

export const collectDatasetIdsFromWorkflowApp = (app: WorkflowAppRecord): string[] => {
  const ids = new Set<string>();
  appendDatasetIds(ids, app.chatbotOrchestration?.datasetIds);

  const nodes = app.dsl?.workflow?.graph?.nodes;
  if (!Array.isArray(nodes)) {
    return [...ids];
  }

  for (const node of nodes) {
    const data = node.data;
    appendDatasetIds(ids, (data as { dataset_ids?: unknown }).dataset_ids);
    const inputs = (data as { inputs?: { dataset_ids?: unknown } }).inputs;
    if (inputs) {
      appendDatasetIds(ids, inputs.dataset_ids);
    }
  }

  return [...ids];
};

export const findWorkflowAppsUsingDataset = (datasetId: string): WorkflowDatasetUsage[] => {
  return listWorkflowApps()
    .filter((app) => collectDatasetIdsFromWorkflowApp(app).includes(datasetId))
    .map((app) => ({ appId: app.id, appName: app.name }));
};

export const formatWorkflowDatasetInUseMessage = (usages: WorkflowDatasetUsage[]): string => {
  const names = usages.map((usage) => `「${usage.appName}」`).join('、');
  return `该知识库正被工作流应用 ${names} 使用，无法删除`;
};
