import { createElement, useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ValueSelector, VariableOption } from '../../../domains/workflow/editor/panels/llm-panel/types';
import {
  WORKFLOW_APPS_STORAGE_KEY,
  WORKFLOW_DRAFT_PREVIEW_STORAGE_PREFIX,
  listPublishedChatbotWorkflowApps,
  type WorkflowAppRecord,
} from '../../../domains/workflow/app/workflowAppStore';
import type { LocalChatMessage, RecentDialogueItem } from '../types';
import { markLastAssistantMessageIncomplete } from '../utils/chatStreamHelpers';
import type { PlaygroundStreamRequestRefs } from './playgroundStreamRequest';
import { interruptActivePlaygroundStream } from './playgroundStreamRequest';

type UsePublishedChatbotPlaygroundParams = {
  authToken: string;
  sessionId: string;
  publishedChatbotWorkflowAppId: string | null;
  setPublishedChatbotWorkflowAppId: (value: string | null) => void;
  streamRefs: PlaygroundStreamRequestRefs;
  flushRemainingAssistantBuffer: () => void;
  abortStreamingAssistantMessage: () => void;
  resetAssistantStreamingState: () => void;
  setMessages: Dispatch<SetStateAction<LocalChatMessage[]>>;
  setIsStreaming: (value: boolean) => void;
  setIsOrchestrating: (value: boolean) => void;
  clearTimelineEvents: () => void;
  setHistorySwitchConfirmTarget: (value: RecentDialogueItem | null) => void;
  hydrateSessionMessages: (sessionId?: string) => Promise<void>;
  refreshMemoryMetrics: (sessionId?: string) => Promise<void>;
};

export const usePublishedChatbotPlayground = ({
  authToken,
  sessionId,
  publishedChatbotWorkflowAppId,
  setPublishedChatbotWorkflowAppId,
  streamRefs,
  flushRemainingAssistantBuffer,
  abortStreamingAssistantMessage,
  resetAssistantStreamingState,
  setMessages,
  setIsStreaming,
  setIsOrchestrating,
  clearTimelineEvents,
  setHistorySwitchConfirmTarget,
  hydrateSessionMessages,
  refreshMemoryMetrics,
}: UsePublishedChatbotPlaygroundParams) => {
  const navigate = useNavigate();
  const [publishedChatbotApps, setPublishedChatbotApps] = useState<WorkflowAppRecord[]>(() =>
    listPublishedChatbotWorkflowApps(),
  );
  const [isWorkflowBlankCreateDialogOpen, setIsWorkflowBlankCreateDialogOpen] = useState(false);

  const refreshPublishedChatbotApps = useCallback(() => {
    setPublishedChatbotApps(listPublishedChatbotWorkflowApps());
  }, []);

  useEffect(() => {
    refreshPublishedChatbotApps();
  }, [refreshPublishedChatbotApps]);

  useEffect(() => {
    const onFocus = () => {
      refreshPublishedChatbotApps();
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === WORKFLOW_APPS_STORAGE_KEY ||
        event.key?.startsWith(WORKFLOW_DRAFT_PREVIEW_STORAGE_PREFIX)
      ) {
        refreshPublishedChatbotApps();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    const onWorkflowAppsChanged = () => {
      refreshPublishedChatbotApps();
    };
    window.addEventListener('kronos:workflow-apps-changed', onWorkflowAppsChanged);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('kronos:workflow-apps-changed', onWorkflowAppsChanged);
    };
  }, [refreshPublishedChatbotApps]);

  useEffect(() => {
    if (!publishedChatbotWorkflowAppId) {
      return;
    }
    if (!publishedChatbotApps.some((row) => row.id === publishedChatbotWorkflowAppId)) {
      setPublishedChatbotWorkflowAppId(null);
    }
  }, [publishedChatbotApps, publishedChatbotWorkflowAppId, setPublishedChatbotWorkflowAppId]);

  const publishedChatbotRagValueSelector = useMemo((): ValueSelector => {
    if (!publishedChatbotWorkflowAppId) {
      return ['playground', 'none'];
    }
    return ['playground', 'app', publishedChatbotWorkflowAppId];
  }, [publishedChatbotWorkflowAppId]);

  const publishedChatbotRagVariableOptions = useMemo((): VariableOption[] => {
    return [
      {
        label: '.＋创建知识库',
        triggerLabel: createElement('span', { className: 'text-blue-600' }, '＋创建知识库'),
        valueSelector: ['playground', 'workflow-create'],
        valueType: 'RAG',
        source: 'node',
      },
      ...publishedChatbotApps.map(
        (app): VariableOption => ({
          label: `.${app.name}`,
          triggerLabel: app.name,
          valueSelector: ['playground', 'app', app.id],
          valueType: 'RAG',
          source: 'node',
        }),
      ),
    ];
  }, [publishedChatbotApps]);

  const handlePublishedChatbotRagVariableChange = useCallback(
    (value: ValueSelector) => {
      if (value[0] !== 'playground') {
        return;
      }
      const segment = value[1];
      if (segment === 'workflow-create') {
        setIsWorkflowBlankCreateDialogOpen(true);
        return;
      }
      if (segment === 'none') {
        setPublishedChatbotWorkflowAppId(null);
        return;
      }
      if (segment === 'app' && typeof value[2] === 'string' && value[2].length > 0) {
        setPublishedChatbotWorkflowAppId(value[2]);
      }
    },
    [setPublishedChatbotWorkflowAppId],
  );

  const closeWorkflowBlankCreateDialog = useCallback(() => {
    setIsWorkflowBlankCreateDialogOpen(false);
  }, []);

  const handleWorkflowBlankAppCreated = useCallback(
    (app: WorkflowAppRecord) => {
      setIsWorkflowBlankCreateDialogOpen(false);
      navigate(`/workflow/config?appId=${encodeURIComponent(app.id)}`);
    },
    [navigate],
  );

  const clearPublishedChatbotRagSelection = useCallback(() => {
    interruptActivePlaygroundStream(streamRefs, {
      flushRemainingAssistantBuffer,
      abortStreamingAssistantMessage,
      markLastAssistantIncomplete: () => {
        setMessages((prev) => markLastAssistantMessageIncomplete(prev));
      },
    });
    streamRefs.activeControllerRef.current = null;

    setIsStreaming(false);
    setIsOrchestrating(false);
    resetAssistantStreamingState();
    clearTimelineEvents();
    setHistorySwitchConfirmTarget(null);
    setPublishedChatbotWorkflowAppId(null);

    if (authToken) {
      void hydrateSessionMessages(sessionId);
      void refreshMemoryMetrics(sessionId);
    }
  }, [
    abortStreamingAssistantMessage,
    authToken,
    clearTimelineEvents,
    flushRemainingAssistantBuffer,
    hydrateSessionMessages,
    refreshMemoryMetrics,
    resetAssistantStreamingState,
    sessionId,
    setHistorySwitchConfirmTarget,
    setIsOrchestrating,
    setIsStreaming,
    setMessages,
    setPublishedChatbotWorkflowAppId,
    streamRefs,
  ]);

  return {
    clearPublishedChatbotRagSelection,
    closeWorkflowBlankCreateDialog,
    handlePublishedChatbotRagVariableChange,
    handleWorkflowBlankAppCreated,
    isWorkflowBlankCreateDialogOpen,
    publishedChatbotApps,
    publishedChatbotRagValueSelector,
    publishedChatbotRagVariableOptions,
  };
};
