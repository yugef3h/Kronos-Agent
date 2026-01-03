import { apiUrl } from '../../lib/api';
import { isViteDev } from '../../lib/viteEnv';
import {
  deleteWorkflowExampleApp,
  getWorkflowExampleAppsCache,
  getWorkflowExamplePreviewSrc,
  isWorkflowExampleAppId,
  saveWorkflowExampleApp,
} from './workflowExampleClient';

export type LegacyWorkflowNodeType =
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

export type LegacyWorkflowNode = {
  id: string;
  type: LegacyWorkflowNodeType;
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

export type LegacyWorkflowEdge = {
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

export type LegacyWorkflowDSL = {
  version: string;
  nodes: LegacyWorkflowNode[];
  edges: LegacyWorkflowEdge[];
  metadata?: Record<string, unknown>;
};

export type WorkflowGraphNodeSemanticType =
  | 'start'
  | 'llm'
  | 'end'
  | 'knowledge-retrieval'
  | 'if-else'
  | 'iteration'
  | 'iteration-start'
  | 'iteration-end'
  | 'loop'
  | 'loop-start'
  | 'loop-end';

export type WorkflowGraphNode = {
  id: string;
  type: 'custom';
  position: { x: number; y: number };
  positionAbsolute?: { x: number; y: number };
  width?: number;
  height?: number;
  parentId?: string;
  sourcePosition?: 'left' | 'right' | 'top' | 'bottom';
  targetPosition?: 'left' | 'right' | 'top' | 'bottom';
  selected?: boolean;
  data: {
    type: WorkflowGraphNodeSemanticType;
    title: string;
    selected?: boolean;
    [key: string]: unknown;
  };
};

export type WorkflowGraphEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: 'custom';
  zIndex?: number;
  data?: {
    isInIteration?: boolean;
    iteration_id?: string;
    isInLoop?: boolean;
    loop_id?: string;
    sourceType?: string;
    targetType?: string;
    [key: string]: unknown;
  };
};

/**
 * 与 Dify 导出 YAML `app.mode`（`AppMode`）对齐的常见取值。
 * @see https://github.com/langgenius/dify/blob/main/api/models/model.py AppMode
 */
export type WorkflowDslAppMode = 'workflow' | 'chat' | 'advanced-chat';

/** 创建弹窗可选：Chatbot ↔ `chat`，Chatflow ↔ `advanced-chat`（勿用 `chatflow` 字符串，非 Dify 合法值）。 */
export type WorkflowAppCreationMode = 'chat' | 'advanced-chat';

/** Chatbot（`app.mode: chat`）编排侧持久化：提示词、上下文知识库等，与画布 DSL 并列存于应用记录。 */
export type WorkflowChatbotMetadataCondition = {
  id?: string;
  field: string;
  operator: 'contains' | 'equals' | 'not_equals';
  value: string;
};

/** Chatbot 编排「召回设置」弹窗持久化，对应 `knowledge-retrieval/query` 的 multiWay 段（rerank 启发式；多查询改写由服务端 env 控制）。 */
export type WorkflowChatbotRecallSettings = {
  rerankingEnabled: boolean;
  topK: number;
  rerankingModel?: string;
};

/** 提示词中的 `{{key}}` 占位符；正式对话前由表单收集取值（调试区先手动填）。 */
export type WorkflowChatbotPromptVariable = {
  id: string;
  /** 占位符名，须与提示词里 `{{key}}` 一致 */
  key: string;
  /** 表单展示名，可选 */
  label?: string;
};

export type WorkflowChatbotOrchestration = {
  systemPrompt: string;
  datasetIds: string[];
  metadataFilterMode: 'disabled' | 'manual';
  /** `metadataFilterMode === 'manual'` 时参与 `knowledge-retrieval/query` */
  metadataFilterConditions?: WorkflowChatbotMetadataCondition[];
  recallSettings?: WorkflowChatbotRecallSettings;
  /** 提示词变量定义（与 `{{key}}` 对应） */
  promptVariables?: WorkflowChatbotPromptVariable[];
  /** 调试/对话是否允许用户附带图片（多模态输入） */
  visionEnabled: boolean;
  /** 单轮最多上传图片张数（1–10），默认 3 */
  visionMaxImages: number;
};

export const createDefaultChatbotRecallSettings = (): WorkflowChatbotRecallSettings => ({
  rerankingEnabled: false,
  topK: 4,
  rerankingModel: 'default-rerank',
});

export const createDefaultChatbotOrchestration = (): WorkflowChatbotOrchestration => ({
  systemPrompt: '',
  datasetIds: [],
  metadataFilterMode: 'disabled',
  metadataFilterConditions: [],
  recallSettings: createDefaultChatbotRecallSettings(),
  promptVariables: [],
  visionEnabled: false,
  visionMaxImages: 3,
});

const normalizeDslAppMode = (raw: unknown): WorkflowDslAppMode => {
  if (raw === 'workflow' || raw === 'chat' || raw === 'advanced-chat') {
    return raw;
  }
  // 历史本地草稿曾写入非法字面量
  if (raw === 'chatflow') {
    return 'advanced-chat';
  }
  return 'workflow';
};

export type WorkflowDSL = {
  app: {
    description: string;
    icon: string;
    icon_background: string;
    icon_type: 'emoji' | 'image';
    mode: WorkflowDslAppMode;
    name: string;
    use_icon_as_answer_icon: boolean;
  };
  dependencies: Array<{
    current_identifier: string | null;
    type: string;
    value: Record<string, unknown>;
  }>;
  kind: 'app';
  version: string;
  workflow: {
    conversation_variables: unknown[];
    environment_variables: unknown[];
    features: {
      file_upload: {
        allowed_file_extensions: string[];
        allowed_file_types: string[];
        allowed_file_upload_methods: string[];
        enabled: boolean;
        fileUploadConfig: Record<string, number>;
        image: {
          enabled: boolean;
          number_limits: number;
          transfer_methods: string[];
        };
        number_limits: number;
      };
      opening_statement: string;
      retriever_resource: {
        enabled: boolean;
      };
      sensitive_word_avoidance: {
        enabled: boolean;
      };
      speech_to_text: {
        enabled: boolean;
      };
      suggested_questions: string[];
      suggested_questions_after_answer: {
        enabled: boolean;
      };
      text_to_speech: {
        enabled: boolean;
        language: string;
        voice: string;
      };
    };
    graph: {
      edges: WorkflowGraphEdge[];
      nodes: WorkflowGraphNode[];
      viewport?: {
        x: number;
        y: number;
        zoom: number;
      };
    };
    rag_pipeline_variables: unknown[];
  };
};

export type WorkflowAppRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  /**
   * 本地「假发布」：为 true 时可在首页对话里作为已发布的 Chatbot 应用选用（无真实云端发布）。
   */
  mockPublished?: boolean;
  publishedAt?: number;
  /**
   * 列表缩略图 JPEG data URL；运行时由 `kronos_workflow_draft_preview_v1:{appId}` 注入，不写入 `kronos_workflow_apps_v1` JSON，避免撑爆配额。
   */
  draftPreviewDataUrl?: string;
  /** 缩略图已同步到后端 `apps/server/data/workflow-draft-previews`，列表可用 GET URL */
  draftPreviewBackendSynced?: boolean;
  /** 内置示例：服务端 `workflow-examples/previews` 是否存在缩略图（列表 API 注入，不入库 JSON） */
  hasDraftPreview?: boolean;
  dsl: WorkflowDSL;
  /** 仅 `dsl.app.mode === 'chat'` 时使用 */
  chatbotOrchestration?: WorkflowChatbotOrchestration;
};

export const WORKFLOW_APPS_STORAGE_KEY = 'kronos_workflow_apps_v1';

/** 与 app.id 一一对应：`{prefix}{appId}` */
export const WORKFLOW_DRAFT_PREVIEW_STORAGE_PREFIX = 'kronos_workflow_draft_preview_v1:';

const workflowDraftPreviewKey = (appId: string): string =>
  `${WORKFLOW_DRAFT_PREVIEW_STORAGE_PREFIX}${appId}`;

const canUseLocalStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const logPreviewLocalStorageError = (where: string, err: unknown, extra?: Record<string, unknown>): void => {
  const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : 'unknown';
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[workflow:preview] localStorage ${where}`, { name, message, ...extra });
};

const readWorkflowDraftPreviewDataUrl = (appId: string): string | undefined => {
  if (!canUseLocalStorage()) {
    return undefined;
  }
  try {
    const v = window.localStorage.getItem(workflowDraftPreviewKey(appId));
    return v && v.length > 0 ? v : undefined;
  } catch (err) {
    logPreviewLocalStorageError('getItem 缩略图失败', err, {
      key: workflowDraftPreviewKey(appId),
    });
    return undefined;
  }
};

const writeWorkflowDraftPreviewDataUrl = (appId: string, dataUrl: string | null | undefined): void => {
  if (!canUseLocalStorage()) {
    if (isViteDev()) {
      console.warn('[workflow:preview] 无 localStorage，跳过侧键缩略图（可依赖后端）', { appId });
    }
    return;
  }
  const key = workflowDraftPreviewKey(appId);
  const op = typeof dataUrl === 'string' && dataUrl.length > 0 ? 'setItem' : 'removeItem';
  try {
    if (typeof dataUrl === 'string' && dataUrl.length > 0) {
      window.localStorage.setItem(key, dataUrl);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    logPreviewLocalStorageError(`${op} 缩略图失败（常见：QuotaExceeded 配额/图片过大）`, err, {
      key,
      payloadChars: typeof dataUrl === 'string' ? dataUrl.length : 0,
    });
  }
};

/** 列表缩略图：按 appId 写入独立 localStorage 键（`kronos_workflow_draft_preview_v1:{id}`） */
export const setWorkflowDraftPreview = (appId: string, dataUrl: string | null): void => {
  writeWorkflowDraftPreviewDataUrl(appId, dataUrl);
  if (isViteDev() && canUseLocalStorage()) {
    const key = workflowDraftPreviewKey(appId);
    const roundTrip =
      typeof dataUrl === 'string' && dataUrl.length > 0
        ? window.localStorage.getItem(key)?.length === dataUrl.length
        : window.localStorage.getItem(key) === null;
    console.warn('[workflow:preview] sidecar 写入后校验', {
      key,
      bytes: typeof dataUrl === 'string' ? dataUrl.length : 0,
      roundTripOk: roundTrip,
    });
  }
};

/** 仅解析主 JSON，不做 sidecar 合并（用于更新 `draftPreviewBackendSynced` 等元数据） */
const readPersistedAppRecordsRaw = (): WorkflowAppRecord[] => {
  if (!canUseLocalStorage()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(WORKFLOW_APPS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as WorkflowAppRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logPreviewLocalStorageError('解析 kronos_workflow_apps_v1 失败', err);
    return [];
  }
};

export const markWorkflowDraftPreviewBackendSynced = (appId: string, synced: boolean): void => {
  const apps = readPersistedAppRecordsRaw();
  const idx = apps.findIndex((a) => a.id === appId);
  if (idx < 0) {
    return;
  }
  const row = { ...apps[idx] };
  delete row.draftPreviewDataUrl;
  if (synced) {
    row.draftPreviewBackendSynced = true;
  } else {
    delete row.draftPreviewBackendSynced;
  }
  const next = [...apps];
  next[idx] = row;
  writeAppRecords(next);
};

/** 列表 `<img src>`：优先本地 data URL，否则已同步后端时用 GET（需 `pnpm dev` 起 server） */
export const getWorkflowDraftThumbnailSrc = (app: WorkflowAppRecord): string | undefined => {
  if (app.draftPreviewDataUrl) {
    return app.draftPreviewDataUrl;
  }
  if (isWorkflowExampleAppId(app.id)) {
    return getWorkflowExamplePreviewSrc(app);
  }
  if (app.draftPreviewBackendSynced) {
    return apiUrl(
      `/api/workflow/apps/${encodeURIComponent(app.id)}/draft-preview?v=${encodeURIComponent(String(app.updatedAt))}`,
    );
  }
  return undefined;
};

const readAppRecords = (): WorkflowAppRecord[] => {
  const parsed = readPersistedAppRecordsRaw();
  if (!parsed.length) {
    return [];
  }

  let shouldCompactMainJson = false;
  const merged = parsed.map((app) => {
    const inline = app?.draftPreviewDataUrl;
    if (typeof inline === 'string' && inline.length > 0) {
      shouldCompactMainJson = true;
      const sideKey = workflowDraftPreviewKey(app.id);
      try {
        if (!window.localStorage.getItem(sideKey)) {
          window.localStorage.setItem(sideKey, inline);
        }
      } catch (err) {
        logPreviewLocalStorageError('迁移内联缩略图到侧键失败', err, { sideKey, chars: inline.length });
      }
    }

    const base: WorkflowAppRecord = { ...app };
    delete base.draftPreviewDataUrl;
    const fromKey = readWorkflowDraftPreviewDataUrl(app.id);
    const withPreview = fromKey ? { ...base, draftPreviewDataUrl: fromKey } : base;
    const mode = normalizeDslAppMode(withPreview.dsl?.app?.mode);
    if (mode === withPreview.dsl.app.mode) {
      return withPreview;
    }
    return {
      ...withPreview,
      dsl: {
        ...withPreview.dsl,
        app: { ...withPreview.dsl.app, mode },
      },
    };
  });

  if (shouldCompactMainJson) {
    try {
      writeAppRecords(merged);
    } catch (err) {
      logPreviewLocalStorageError('压缩主 JSON（去掉内联缩略图）失败', err);
    }
  }

  return merged;
};

const writeAppRecords = (apps: WorkflowAppRecord[]): void => {
  if (!canUseLocalStorage()) {
    return;
  }
  const persisted = apps.map(({ draftPreviewDataUrl: _p, ...rest }) => rest);
  try {
    window.localStorage.setItem(WORKFLOW_APPS_STORAGE_KEY, JSON.stringify(persisted));
  } catch (err) {
    logPreviewLocalStorageError('setItem 主应用列表失败', err, {
      apps: persisted.length,
    });
  }
};

const createEmptyDsl = (name: string, mode: WorkflowDslAppMode = 'workflow'): WorkflowDSL => {
  return {
    app: {
      description: '',
      icon: '🤖',
      icon_background: '#FFEAD5',
      icon_type: 'emoji',
      mode,
      name,
      use_icon_as_answer_icon: false,
    },
    dependencies: [],
    kind: 'app',
    version: '0.6.0',
    workflow: {
      conversation_variables: [],
      environment_variables: [],
      features: {
        file_upload: {
          allowed_file_extensions: ['.JPG', '.JPEG', '.PNG', '.GIF', '.WEBP', '.SVG'],
          allowed_file_types: ['image'],
          allowed_file_upload_methods: ['local_file', 'remote_url'],
          enabled: false,
          fileUploadConfig: {
            attachment_image_file_size_limit: 2,
            audio_file_size_limit: 50,
            batch_count_limit: 5,
            file_size_limit: 15,
            file_upload_limit: 50,
            image_file_batch_limit: 10,
            image_file_size_limit: 10,
            single_chunk_attachment_limit: 10,
            video_file_size_limit: 100,
            workflow_file_upload_limit: 10,
          },
          image: {
            enabled: false,
            number_limits: 3,
            transfer_methods: ['local_file', 'remote_url'],
          },
          number_limits: 3,
        },
        opening_statement: '',
        retriever_resource: {
          enabled: true,
        },
        sensitive_word_avoidance: {
          enabled: false,
        },
        speech_to_text: {
          enabled: false,
        },
        suggested_questions: [],
        suggested_questions_after_answer: {
          enabled: false,
        },
        text_to_speech: {
          enabled: false,
          language: '',
          voice: '',
        },
      },
      graph: {
        edges: [],
        nodes: [],
        viewport: {
          x: 0,
          y: 0,
          zoom: 1,
        },
      },
      rag_pipeline_variables: [],
    },
  };
};

const generateWorkflowAppId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `wf_${Date.now().toString(36)}_${randomPart}`;
};

/** 列表展示：按创建时间升序，更新不改变顺序。 */
export const sortWorkflowAppsByCreatedAt = (apps: WorkflowAppRecord[]): WorkflowAppRecord[] => {
  return [...apps].sort((a, b) => a.createdAt - b.createdAt);
};

const mergeLocalAndExampleApps = (): WorkflowAppRecord[] => {
  const local = readAppRecords();
  const localIds = new Set(local.map((app) => app.id));
  const examples = getWorkflowExampleAppsCache().filter((app) => !localIds.has(app.id));
  return sortWorkflowAppsByCreatedAt([...examples, ...local]);
};

const findExampleApp = (appId: string): WorkflowAppRecord | undefined =>
  getWorkflowExampleAppsCache().find((app) => app.id === appId);

const persistWorkflowExampleRecord = (record: WorkflowAppRecord): void => {
  const rest = { ...record };
  delete rest.draftPreviewDataUrl;
  delete rest.hasDraftPreview;
  void saveWorkflowExampleApp(rest);
};

export const listWorkflowApps = (): WorkflowAppRecord[] => mergeLocalAndExampleApps();

/** 已假发布且为 Chatbot（`dsl.app.mode === 'chat'`）的应用，供首页对话 RAG 应用下拉使用。 */
export const listPublishedChatbotWorkflowApps = (): WorkflowAppRecord[] => {
  return sortWorkflowAppsByCreatedAt(
    mergeLocalAndExampleApps().filter(
      (app) => app.dsl.app.mode === 'chat' && Boolean(app.mockPublished),
    ),
  );
};

export const setWorkflowAppMockPublished = (appId: string, mockPublished: boolean): WorkflowAppRecord | undefined => {
  const example = findExampleApp(appId);
  if (example) {
    const updatedApp: WorkflowAppRecord = {
      ...example,
      updatedAt: Date.now(),
      mockPublished,
    };
    delete updatedApp.draftPreviewDataUrl;
    persistWorkflowExampleRecord(updatedApp);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kronos:workflow-apps-changed'));
    }
    return updatedApp;
  }

  const apps = readAppRecords();
  const appIndex = apps.findIndex((app) => app.id === appId);
  if (appIndex < 0) {
    return undefined;
  }

  const prev = apps[appIndex];
  const updatedApp: WorkflowAppRecord = {
    ...prev,
    updatedAt: Date.now(),
    mockPublished,
  };
  delete updatedApp.draftPreviewDataUrl;

  apps[appIndex] = updatedApp;
  writeAppRecords(apps);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kronos:workflow-apps-changed'));
  }

  const previewUrl = readWorkflowDraftPreviewDataUrl(appId);
  return previewUrl ? { ...updatedApp, draftPreviewDataUrl: previewUrl } : updatedApp;
};

export const getWorkflowAppById = (id: string): WorkflowAppRecord | undefined => {
  const local = readAppRecords().find((a) => a.id === id);
  if (local) {
    return local;
  }
  return findExampleApp(id);
};

export const getWorkflowAppEditorPath = (app: WorkflowAppRecord): string => {
  const target =
    app.dsl.app.mode === 'chat'
      ? `/workflow/config?appId=${encodeURIComponent(app.id)}`
      : `/workflow/draft?appId=${encodeURIComponent(app.id)}`;
  return target;
};

export const updateWorkflowAppChatbotOrchestration = (
  appId: string,
  recipe: (previous: WorkflowChatbotOrchestration) => WorkflowChatbotOrchestration,
): WorkflowAppRecord | undefined => {
  const example = findExampleApp(appId);
  if (example) {
    const base = example.chatbotOrchestration ?? createDefaultChatbotOrchestration();
    const updatedApp: WorkflowAppRecord = {
      ...example,
      updatedAt: Date.now(),
      chatbotOrchestration: recipe(base),
    };
    delete updatedApp.draftPreviewDataUrl;
    persistWorkflowExampleRecord(updatedApp);
    return updatedApp;
  }

  const apps = readAppRecords();
  const appIndex = apps.findIndex((app) => app.id === appId);
  if (appIndex < 0) {
    return undefined;
  }

  const prev = apps[appIndex];
  const base = prev.chatbotOrchestration ?? createDefaultChatbotOrchestration();
  const updatedApp: WorkflowAppRecord = {
    ...prev,
    updatedAt: Date.now(),
    chatbotOrchestration: recipe(base),
  };
  delete updatedApp.draftPreviewDataUrl;

  apps[appIndex] = updatedApp;
  writeAppRecords(apps);

  const previewUrl = readWorkflowDraftPreviewDataUrl(appId);
  return previewUrl ? { ...updatedApp, draftPreviewDataUrl: previewUrl } : updatedApp;
};

export const updateWorkflowAppDsl = (appId: string, dsl: WorkflowDSL): WorkflowAppRecord | undefined => {
  const example = findExampleApp(appId);
  if (example) {
    const updatedApp: WorkflowAppRecord = {
      ...example,
      updatedAt: Date.now(),
      dsl,
    };
    delete updatedApp.draftPreviewDataUrl;
    persistWorkflowExampleRecord(updatedApp);
    return updatedApp;
  }

  const apps = readAppRecords();
  const appIndex = apps.findIndex((app) => app.id === appId);
  if (appIndex < 0) {
    return undefined;
  }

  const prev = apps[appIndex];
  const updatedApp: WorkflowAppRecord = {
    ...prev,
    updatedAt: Date.now(),
    dsl,
  };
  delete updatedApp.draftPreviewDataUrl;

  apps[appIndex] = updatedApp;
  writeAppRecords(apps);

  const previewUrl = readWorkflowDraftPreviewDataUrl(appId);
  return previewUrl ? { ...updatedApp, draftPreviewDataUrl: previewUrl } : updatedApp;
};

export const updateWorkflowAppMeta = (
  appId: string,
  payload: { name: string; description?: string },
): WorkflowAppRecord | undefined => {
  const name = payload.name.trim();
  if (!name) {
    throw new Error('应用名称不能为空');
  }

  const example = findExampleApp(appId);
  if (example) {
    const description = payload.description?.trim() ?? '';
    const updatedApp: WorkflowAppRecord = {
      ...example,
      name,
      description,
      updatedAt: Date.now(),
      dsl: {
        ...example.dsl,
        app: {
          ...example.dsl.app,
          name,
          description,
        },
      },
    };
    delete updatedApp.draftPreviewDataUrl;
    persistWorkflowExampleRecord(updatedApp);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kronos:workflow-apps-changed'));
    }
    return updatedApp;
  }

  const apps = readAppRecords();
  const appIndex = apps.findIndex((app) => app.id === appId);
  if (appIndex < 0) {
    return undefined;
  }

  const prev = apps[appIndex];
  const description = payload.description?.trim() ?? '';
  const updatedApp: WorkflowAppRecord = {
    ...prev,
    name,
    description,
    updatedAt: Date.now(),
    dsl: {
      ...prev.dsl,
      app: {
        ...prev.dsl.app,
        name,
        description,
      },
    },
  };
  delete updatedApp.draftPreviewDataUrl;

  apps[appIndex] = updatedApp;
  writeAppRecords(apps);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kronos:workflow-apps-changed'));
  }

  const previewUrl = readWorkflowDraftPreviewDataUrl(appId);
  return previewUrl ? { ...updatedApp, draftPreviewDataUrl: previewUrl } : updatedApp;
};

export const deleteWorkflowApp = (appId: string): boolean => {
  if (isWorkflowExampleAppId(appId)) {
    void deleteWorkflowExampleApp(appId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kronos:workflow-apps-changed'));
    }
    return true;
  }

  const apps = readAppRecords();
  const next = apps.filter((app) => app.id !== appId);
  if (next.length === apps.length) {
    return false;
  }

  writeAppRecords(next);
  setWorkflowDraftPreview(appId, null);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kronos:workflow-apps-changed'));
  }

  return true;
};

export const createWorkflowApp = (payload: {
  name: string;
  description?: string;
  appMode?: WorkflowAppCreationMode;
}): WorkflowAppRecord => {
  const name = payload.name.trim();
  if (!name) {
    throw new Error('应用名称不能为空');
  }

  const now = Date.now();
  const dslMode: WorkflowDslAppMode = payload.appMode ?? 'workflow';
  const newRecord: WorkflowAppRecord = {
    id: generateWorkflowAppId(),
    name,
    description: payload.description?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
    dsl: createEmptyDsl(name, dslMode),
    ...(dslMode === 'chat' ? { chatbotOrchestration: createDefaultChatbotOrchestration() } : {}),
  };

  const next = [newRecord, ...readAppRecords()];
  writeAppRecords(next);

  return newRecord;
};
