import { useDebounceFn } from 'ahooks';
import { useCallback, useEffect, useState } from 'react';

import {
  WORKFLOW_APPS_STORAGE_KEY,
  createDefaultChatbotOrchestration,
  createDefaultChatbotRecallSettings,
  getWorkflowAppById,
  updateWorkflowAppChatbotOrchestration,
  type WorkflowChatbotOrchestration,
} from '../../../features/workflow/workflowAppStore';

const normalizeOrch = (raw: WorkflowChatbotOrchestration | undefined): WorkflowChatbotOrchestration => {
  const base = raw ?? createDefaultChatbotOrchestration();
  const rsDefault = createDefaultChatbotRecallSettings();
  return {
    ...base,
    metadataFilterConditions: (base.metadataFilterConditions ?? []).map((c, index) => ({
      ...c,
      id: c.id && String(c.id).length > 0 ? c.id : `cond-${index}`,
    })),
    recallSettings: {
      rerankingEnabled: base.recallSettings?.rerankingEnabled ?? rsDefault.rerankingEnabled,
      topK: Math.min(100, Math.max(1, Math.round(base.recallSettings?.topK ?? rsDefault.topK))),
      rerankingModel: base.recallSettings?.rerankingModel ?? rsDefault.rerankingModel,
    },
  };
};

export const useWorkflowChatbotOrch = (appId: string | undefined) => {
  const [orch, setOrch] = useState<WorkflowChatbotOrchestration>(() => normalizeOrch(undefined));

  const load = useCallback(() => {
    const id = appId?.trim();
    if (!id) {
      return;
    }
    const record = getWorkflowAppById(id);
    if (!record) {
      return;
    }
    setOrch(normalizeOrch(record.chatbotOrchestration));
  }, [appId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === WORKFLOW_APPS_STORAGE_KEY) {
        load();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [load]);

  const persistOrch = useCallback(
    (recipe: (previous: WorkflowChatbotOrchestration) => WorkflowChatbotOrchestration) => {
      const id = appId?.trim();
      if (!id) {
        return;
      }
      const updated = updateWorkflowAppChatbotOrchestration(id, recipe);
      if (updated?.chatbotOrchestration) {
        setOrch(normalizeOrch(updated.chatbotOrchestration));
      }
    },
    [appId],
  );

  const { run: debouncedPersistPrompt } = useDebounceFn(
    (text: string) => {
      const id = appId?.trim();
      if (!id) {
        return;
      }
      updateWorkflowAppChatbotOrchestration(id, (prev) => ({ ...prev, systemPrompt: text }));
    },
    { wait: 400 },
  );

  return {
    orch,
    setOrch,
    persistOrch,
    debouncedPersistPrompt,
    reloadFromStore: load,
  };
};
