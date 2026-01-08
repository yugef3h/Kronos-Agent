import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Node } from 'reactflow';
import { syncWorkflowDraftPreviewToBackend } from '../../app/workflowDraftPreviewBackendSync';
import {
  getWorkflowAppById,
  setWorkflowDraftPreview,
  updateWorkflowAppDsl,
  type WorkflowAppRecord,
  type WorkflowDSL,
} from '../../app/workflowAppStore';
import { useWorkflowDraftStore, type WorkflowDraftBackup } from '../../../../store/workflowDraftStore';
import type { Edge } from '../types/common';
import type { CanvasNodeData } from '../types/canvas';
import { createWorkflowDslFromCanvas, hydrateCanvasNodesFromDsl } from '../utils/workflow-dsl';
import { useDraftBackup, usePersistedDraft } from './use-persisted-draft';

type RefreshDraftOptions = {
  skipApply?: boolean;
};

type UseWorkflowDraftPersistenceOptions = {
  appId?: string | null;
  appName?: string;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<Node<CanvasNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  /** 与 DSL 一并写入列表缩略图；至少 1 个节点时才调用 */
  captureDraftPreview?: () => Promise<string | null>;
};

type PersistDraftSnapshot = {
  appId: string;
  dsl: WorkflowDSL;
  nodeCount: number;
};

type DebouncedDraftSync = {
  (fn: () => void): void;
  cancel: () => void;
};

/** 草稿 DSL（及缩略图）写入 localStorage 前的防抖间隔 */
export const WORKFLOW_DRAFT_PERSIST_DEBOUNCE_MS = 700;

const PERSIST_DEBOUNCE_MS = WORKFLOW_DRAFT_PERSIST_DEBOUNCE_MS;

export const useWorkflowDraftPersistence = ({
  appId,
  appName,
  nodes,
  edges,
  setNodes,
  setEdges,
  captureDraftPreview,
}: UseWorkflowDraftPersistenceOptions) => {
  const lastPersistedDslRef = useRef<string | null>(null);
  const setCurrentApp = useWorkflowDraftStore((state) => state.setCurrentApp);
  const setDraftUpdatedAt = useWorkflowDraftStore((state) => state.setDraftUpdatedAt);
  const setPublishedAt = useWorkflowDraftStore((state) => state.setPublishedAt);
  const setIsSyncingWorkflowDraft = useWorkflowDraftStore((state) => state.setIsSyncingWorkflowDraft);
  const hasBackupDraft = useWorkflowDraftStore((state) => state.backupDraft?.appId === appId);

  const captureDraftPreviewRef = useRef(captureDraftPreview);
  captureDraftPreviewRef.current = captureDraftPreview;

  const debouncedSyncWorkflowDraft = useMemo<DebouncedDraftSync>(() => {
    let timer: number | undefined;

    const schedule = ((fn: () => void) => {
      if (timer) {
        window.clearTimeout(timer);
      }

      timer = window.setTimeout(() => {
        timer = undefined;
        fn();
      }, PERSIST_DEBOUNCE_MS);
    }) as DebouncedDraftSync;

    schedule.cancel = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    return schedule;
  }, []);

  const currentDslSignature = useMemo(() => {
    if (!appId) {
      return null;
    }

    return JSON.stringify(createWorkflowDslFromCanvas(nodes, edges, appName));
  }, [appId, appName, edges, nodes]);

  const createSnapshot = useCallback((): PersistDraftSnapshot | null => {
    if (!appId) {
      return null;
    }

    return {
      appId,
      dsl: createWorkflowDslFromCanvas(nodes, edges, appName),
      nodeCount: nodes.length,
    };
  }, [appId, appName, edges, nodes]);

  const {
    persistNow,
    schedulePersist,
    persistWhenPageClose,
    refreshLatest,
  } = usePersistedDraft<
    PersistDraftSnapshot,
    PersistDraftSnapshot,
    WorkflowAppRecord,
    WorkflowAppRecord | undefined,
    void,
    RefreshDraftOptions
  >({
    debouncePersist: debouncedSyncWorkflowDraft,
    createSnapshot,
    createPersistPayload: (snapshot) => snapshot,
    persist: async (snapshot) => {
      if (import.meta.env.DEV) {
        console.warn('[workflow:preview] draft persist（仅草稿页）', {
          appId: snapshot.appId,
          nodeCount: snapshot.nodeCount,
          willTryCapture: snapshot.nodeCount >= 1 && Boolean(captureDraftPreviewRef.current),
        });
      }

      let dataUrl: string | null = null;
      const cap = captureDraftPreviewRef.current;
      if (snapshot.nodeCount >= 1 && cap) {
        try {
          dataUrl = await cap();
        } catch (err) {
          console.error('err', err);
        }
      }

      if (import.meta.env.DEV) {
        console.warn('[workflow:preview] capture 结果', {
          appId: snapshot.appId,
          gotDataUrl: Boolean(dataUrl?.length),
          approxChars: dataUrl?.length ?? 0,
        });
      }

      if (typeof dataUrl === 'string' && dataUrl.length > 0) {
        setWorkflowDraftPreview(snapshot.appId, dataUrl);
        void syncWorkflowDraftPreviewToBackend(snapshot.appId, dataUrl);
      }

      const updatedApp = updateWorkflowAppDsl(snapshot.appId, snapshot.dsl);

      if (!updatedApp) {
        throw new Error('workflow app not found');
      }

      return updatedApp;
    },
    persistWithKeepalive: (snapshot) => {
      if (import.meta.env.DEV) {
        console.warn('[workflow:preview] pagehide 仅写 DSL，不写缩略图', { appId: snapshot.appId });
      }
      updateWorkflowAppDsl(snapshot.appId, snapshot.dsl);
    },
    onPersistSuccess: (result) => {
      lastPersistedDslRef.current = JSON.stringify(result.dsl);
      setDraftUpdatedAt(result.updatedAt);
      setPublishedAt(result.publishedAt ?? null);
      setIsSyncingWorkflowDraft(false);
    },
    onPersistError: () => {
      setIsSyncingWorkflowDraft(false);
    },
    beforeRefresh: () => {
      debouncedSyncWorkflowDraft.cancel();
      setIsSyncingWorkflowDraft(true);
    },
    refresh: async () => {
      if (!appId) {
        return undefined;
      }

      return getWorkflowAppById(appId);
    },
    applyRefresh: (result) => {
      if (!result) {
        return;
      }

      setNodes(hydrateCanvasNodesFromDsl(result.dsl));
      setEdges(result.dsl.workflow.graph.edges as Edge[]);
      lastPersistedDslRef.current = JSON.stringify(result.dsl);
      setDraftUpdatedAt(result.updatedAt);
      setPublishedAt(result.publishedAt ?? null);
    },
    onRefreshError: () => {
      setIsSyncingWorkflowDraft(false);
    },
    afterRefresh: () => {
      setIsSyncingWorkflowDraft(false);
    },
  });

  const { backup, restore } = useDraftBackup<WorkflowDraftBackup>({
    getBackup: () => {
      const backupDraft = useWorkflowDraftStore.getState().backupDraft;

      if (!appId || backupDraft?.appId !== appId) {
        return undefined;
      }

      return backupDraft;
    },
    setBackup: (snapshot) => {
      useWorkflowDraftStore.getState().setBackupDraft(snapshot);
    },
    createSnapshot: () => ({
      appId: appId!,
      dsl: createWorkflowDslFromCanvas(nodes, edges, appName),
      createdAt: Date.now(),
    }),
    restoreSnapshot: (snapshot) => {
      setNodes(hydrateCanvasNodesFromDsl(snapshot.dsl));
      setEdges(snapshot.dsl.workflow.graph.edges as Edge[]);
      setIsSyncingWorkflowDraft(false);
    },
  });

  const doSyncWorkflowDraft = useCallback(() => {
    return persistNow();
  }, [persistNow]);

  const handleRefreshWorkflowDraft = useCallback((skipApply?: boolean) => {
    if (!appId) {
      return Promise.resolve(undefined);
    }

    backup();
    return refreshLatest({ skipApply });
  }, [appId, backup, refreshLatest]);

  useEffect(() => {
    if (!appId) {
      setCurrentApp(null);
      lastPersistedDslRef.current = null;
      debouncedSyncWorkflowDraft.cancel();
      return;
    }

    const app = getWorkflowAppById(appId);

    setCurrentApp(appId, {
      draftUpdatedAt: app?.updatedAt ?? null,
      publishedAt: app?.publishedAt ?? null,
    });
    lastPersistedDslRef.current = app ? JSON.stringify(app.dsl) : null;
  }, [appId, debouncedSyncWorkflowDraft, setCurrentApp]);

  useEffect(() => {
    if (!appId || !currentDslSignature) {
      return;
    }

    if (currentDslSignature === lastPersistedDslRef.current) {
      return;
    }

    setIsSyncingWorkflowDraft(true);
    schedulePersist();
  }, [appId, currentDslSignature, schedulePersist, setIsSyncingWorkflowDraft]);

  useEffect(() => {
    if (!appId) {
      return;
    }

    const handlePageHide = () => {
      persistWhenPageClose();
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      debouncedSyncWorkflowDraft.cancel();
    };
  }, [appId, debouncedSyncWorkflowDraft, persistWhenPageClose]);

  return {
    doSyncWorkflowDraft,
    syncWorkflowDraftWhenPageClose: persistWhenPageClose,
    handleRefreshWorkflowDraft,
    handleBackupDraft: backup,
    handleLoadBackupDraft: restore,
    hasBackupDraft,
  };
};
