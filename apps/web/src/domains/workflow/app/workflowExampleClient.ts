import { apiUrl } from '../../../lib/api';
import type { WorkflowAppRecord } from './workflowAppStore';

let exampleAppsCache: WorkflowAppRecord[] = [];

export const WORKFLOW_EXAMPLES_CHANGED_EVENT = 'kronos:workflow-examples-changed';

export const getWorkflowExampleAppsCache = (): WorkflowAppRecord[] => exampleAppsCache;

export const isWorkflowExampleAppId = (appId: string): boolean =>
  exampleAppsCache.some((app) => app.id === appId);

/** 内置 workflow 示例：画布与 DSL 只读，仅可查看 / 测试运行 / 单节点调试 */
export const isWorkflowReadOnlyExampleAppId = (appId: string): boolean => isWorkflowExampleAppId(appId);

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

export async function saveWorkflowExampleApp(record: WorkflowAppRecord): Promise<boolean> {
  const response = await fetch(apiUrl(`/api/workflow/examples/${encodeURIComponent(record.id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: record }),
  });
  if (response.status === 403 || response.status === 409) {
    console.warn('[workflow:example] 服务端拒绝保存只读/破坏性示例', {
      appId: record.id,
      status: response.status,
    });
    return false;
  }
  if (!response.ok) {
    throw new Error(`Failed to save workflow example (${response.status})`);
  }
  const idx = exampleAppsCache.findIndex((a) => a.id === record.id);
  const prevHasDraftPreview = idx >= 0 ? exampleAppsCache[idx].hasDraftPreview : false;
  const cached: WorkflowAppRecord = prevHasDraftPreview ? { ...record, hasDraftPreview: true } : record;
  if (idx >= 0) {
    exampleAppsCache = [...exampleAppsCache.slice(0, idx), cached, ...exampleAppsCache.slice(idx + 1)];
  } else {
    exampleAppsCache = [...exampleAppsCache, cached];
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKFLOW_EXAMPLES_CHANGED_EVENT));
  }
  return true;
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

export const getWorkflowExamplePreviewSrc = (
  app: WorkflowAppRecord,
  cacheBust?: number,
): string | undefined => {
  if (!app.hasDraftPreview) {
    return undefined;
  }
  const params = new URLSearchParams({ v: String(app.updatedAt) });
  if (cacheBust != null) {
    params.set('t', String(cacheBust));
  }
  return apiUrl(
    `/api/workflow/examples/${encodeURIComponent(app.id)}/draft-preview?${params.toString()}`,
  );
};
