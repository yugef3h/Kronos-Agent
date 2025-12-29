import bundledAppsJson from './bundled-workflow-apps.json';
import type { WorkflowAppRecord } from '../workflowAppStore';

const WORKFLOW_APPS_STORAGE_KEY = 'kronos_workflow_apps_v1';

/** 仓库内置示例应用 id，对应 `public/workflow-seed-previews/{id}.jpg`。 */
export const BUNDLED_WORKFLOW_APP_IDS = new Set(
  (bundledAppsJson as WorkflowAppRecord[]).map((app) => app.id),
);

export const BUNDLED_WORKFLOW_PREVIEW_BASE = '/workflow-seed-previews';

export const bundledWorkflowApps = bundledAppsJson as WorkflowAppRecord[];

export const getBundledWorkflowPreviewSrc = (appId: string): string | undefined => {
  if (!BUNDLED_WORKFLOW_APP_IDS.has(appId)) {
    return undefined;
  }
  return `${BUNDLED_WORKFLOW_PREVIEW_BASE}/${encodeURIComponent(appId)}.jpg`;
};

const canUseLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

/** 首次访问或缺少内置 id 时合并示例应用，不覆盖用户已有记录。 */
export const ensureBundledWorkflowApps = (): void => {
  if (!canUseLocalStorage() || bundledWorkflowApps.length === 0) {
    return;
  }

  let existing: WorkflowAppRecord[] = [];
  try {
    const raw = window.localStorage.getItem(WORKFLOW_APPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkflowAppRecord[];
      existing = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    existing = [];
  }

  const existingIds = new Set(existing.map((app) => app.id));
  const toAdd = bundledWorkflowApps.filter((app) => !existingIds.has(app.id));
  if (toAdd.length === 0) {
    return;
  }

  const persisted = [...existing, ...toAdd].map(({ draftPreviewDataUrl: _p, ...rest }) => rest);
  try {
    window.localStorage.setItem(WORKFLOW_APPS_STORAGE_KEY, JSON.stringify(persisted));
    window.dispatchEvent(new CustomEvent('kronos:workflow-apps-changed'));
  } catch (err) {
    console.warn('[workflow:seed] 写入内置示例失败', err);
  }
};
