export type WorkflowNodeType =
  | 'trigger'
  | 'agent'
  | 'end'
  | 'tool'
  | 'if'
  | 'loop'
  | 'loop-start'
  | 'loop-end'
  | 'parallel'
  | 'llm'
  | 'knowledge'
  | 'condition'
  | 'iteration'
  | 'iteration-start'
  | 'iteration-end';

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  parentId?: string;
  data: {
    label?: string;
    kind?: string;
    subtitle?: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    _runningStatus?: 'idle' | 'running' | 'finished' | 'failed' | 'paused';
  };
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: {
    sourceType?: string;
    targetType?: string;
    _sourceRunningStatus?: string;
    _targetRunningStatus?: string;
    [key: string]: unknown;
  };
};

export type WorkflowDSL = {
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: Record<string, unknown>;
};

export type WorkflowAppRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  dsl: WorkflowDSL;
};

const WORKFLOW_APPS_STORAGE_KEY = 'kronos_workflow_apps_v1';

const canUseLocalStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const readAppRecords = (): WorkflowAppRecord[] => {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(WORKFLOW_APPS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as WorkflowAppRecord[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
};

const writeAppRecords = (apps: WorkflowAppRecord[]): void => {
  if (!canUseLocalStorage()) {
    return;
  }
  window.localStorage.setItem(WORKFLOW_APPS_STORAGE_KEY, JSON.stringify(apps));
};

const createEmptyDsl = (name: string): WorkflowDSL => {
  return {
    version: '0.1.0',
    nodes: [],
    edges: [],
    metadata: {
      appName: name,
      createdBy: 'kronos-web',
      mode: 'blank-app',
    },
  };
};

const generateWorkflowAppId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `wf_${Date.now().toString(36)}_${randomPart}`;
};

export const listWorkflowApps = (): WorkflowAppRecord[] => {
  return readAppRecords().sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getWorkflowAppById = (id: string): WorkflowAppRecord | undefined => {
  return readAppRecords().find(app => app.id === id)
}

export const updateWorkflowAppDsl = (appId: string, dsl: WorkflowDSL): WorkflowAppRecord | undefined => {
  const apps = readAppRecords()
  const appIndex = apps.findIndex(app => app.id === appId)

  if (appIndex < 0)
    return undefined

  const updatedApp: WorkflowAppRecord = {
    ...apps[appIndex],
    updatedAt: Date.now(),
    dsl,
  }

  apps[appIndex] = updatedApp
  writeAppRecords(apps)

  return updatedApp
}

export const createWorkflowApp = (payload: { name: string; description?: string }): WorkflowAppRecord => {
  const name = payload.name.trim();
  if (!name) {
    throw new Error('应用名称不能为空');
  }

  const now = Date.now();
  const newRecord: WorkflowAppRecord = {
    id: generateWorkflowAppId(),
    name,
    description: payload.description?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
    dsl: createEmptyDsl(name),
  };

  const next = [newRecord, ...readAppRecords()];
  writeAppRecords(next);

  return newRecord;
};
