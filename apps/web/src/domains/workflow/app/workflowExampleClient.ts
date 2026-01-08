import { apiUrl } from '../../../lib/api';
import type { WorkflowAppRecord } from './workflowAppStore';

let exampleAppsCache: WorkflowAppRecord[] = [];

export const WORKFLOW_EXAMPLES_CHANGED_EVENT = 'kronos:workflow-examples-changed';

export const getWorkflowExampleAppsCache = (): WorkflowAppRecord[] => exampleAppsCache;

export const isWorkflowExampleAppId = (appId: string): boolean =>
  exampleAppsCache.some((app) => app.id === appId);

export const setWorkflowExampleAppsCache = (apps: WorkflowAppRecord[]): void => {
  exampleAppsCache = apps;
};

export async function fetchWorkflowExampleApps(): Promise<WorkflowAppRecord[]> {
  const response = await fetch(apiUrl('/api/workflow/examples'));
  if (!response.ok) {
    throw new Error(`Failed to load workflow examples (${response.status})`);
  }
  const data = (await response.json()) as { apps?: WorkflowAppRecord[] };
  const apps = Array.isArray(data.apps) ? data.apps : [];
  exampleAppsCache = apps;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKFLOW_EXAMPLES_CHANGED_EVENT));
  }
  return apps;
}

export async function saveWorkflowExampleApp(record: WorkflowAppRecord): Promise<void> {
  const response = await fetch(apiUrl(`/api/workflow/examples/${encodeURIComponent(record.id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: record }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save workflow example (${response.status})`);
  }
  const idx = exampleAppsCache.findIndex((a) => a.id === record.id);
  if (idx >= 0) {
    exampleAppsCache = [...exampleAppsCache.slice(0, idx), record, ...exampleAppsCache.slice(idx + 1)];
  } else {
    exampleAppsCache = [...exampleAppsCache, record];
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKFLOW_EXAMPLES_CHANGED_EVENT));
  }
}

export async function deleteWorkflowExampleApp(appId: string): Promise<void> {
  const response = await fetch(apiUrl(`/api/workflow/examples/${encodeURIComponent(appId)}`), {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete workflow example (${response.status})`);
  }
  exampleAppsCache = exampleAppsCache.filter((a) => a.id !== appId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKFLOW_EXAMPLES_CHANGED_EVENT));
  }
}

export async function putWorkflowExamplePreview(
  appId: string,
  dataUrl: string,
): Promise<{ ok: boolean; status: number; errorMessage?: string }> {
  try {
    const response = await fetch(
      apiUrl(`/api/workflow/examples/${encodeURIComponent(appId)}/draft-preview`),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      },
    );
    if (response.ok) {
      const idx = exampleAppsCache.findIndex((a) => a.id === appId);
      if (idx >= 0) {
        exampleAppsCache = [
          ...exampleAppsCache.slice(0, idx),
          { ...exampleAppsCache[idx], hasDraftPreview: true },
          ...exampleAppsCache.slice(idx + 1),
        ];
      }
      return { ok: true, status: response.status };
    }
    const errorMessage = await response.text();
    return { ok: false, status: response.status, errorMessage };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      errorMessage: error instanceof Error ? error.message : 'Network request failed',
    };
  }
}

export const getWorkflowExamplePreviewSrc = (app: WorkflowAppRecord): string | undefined => {
  if (!app.hasDraftPreview) {
    return undefined;
  }
  return apiUrl(
    `/api/workflow/examples/${encodeURIComponent(app.id)}/draft-preview?v=${encodeURIComponent(String(app.updatedAt))}`,
  );
};
