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

// Dify 导入/导出最终基线:
// 1. 顶层必须是 `kind: app` + `version: 0.6.0` + `workflow.graph`
// 2. 画布节点统一落在 `workflow.graph.nodes`
// 3. 画布连线统一落在 `workflow.graph.edges`
// 4. knowledge-retrieval 的 YAML 额外约束见 `workflow-dsl.ts` 里的 `serializeKnowledgeInputs()`
export type WorkflowDSL = {
  app: {
    description: string;
    icon: string;
    icon_background: string;
    icon_type: 'emoji' | 'image';
    mode: 'workflow';
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
  publishedAt?: number;
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
    app: {
      description: '',
      icon: '🤖',
      icon_background: '#FFEAD5',
      icon_type: 'emoji',
      mode: 'workflow',
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
        // Dify 新建空工作流导出的安全默认视口。
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
