import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { requestSessionSnapshot } from '../../../lib/api';
import { usePlaygroundStore } from '../../../store/playgroundStore';
import {
  applySessionSnapshotMemoryPatch,
  buildSessionSnapshotMemoryPatch,
} from '../applySessionSnapshot';
import type { LocalChatMessage } from '../types';
import { getLatestUserQuestion, hydrateRenderableMessages } from '../utils/chatStreamHelpers';

type UsePlaygroundSessionHydrationParams = {
  authToken: string;
  playgroundChatStreamSessionId: string;
  hasRestorableDraft: boolean;
  setMessages: Dispatch<SetStateAction<LocalChatMessage[]>>;
  setLatestUserQuestion: (value: string) => void;
  setMemoryMetrics: ReturnType<typeof usePlaygroundStore.getState>['setMemoryMetrics'];
  setMemorySummary: ReturnType<typeof usePlaygroundStore.getState>['setMemorySummary'];
  setMemorySummaryUpdatedAt: ReturnType<typeof usePlaygroundStore.getState>['setMemorySummaryUpdatedAt'];
};

export const usePlaygroundSessionHydration = ({
  authToken,
  playgroundChatStreamSessionId,
  hasRestorableDraft,
  setMessages,
  setLatestUserQuestion,
  setMemoryMetrics,
  setMemorySummary,
  setMemorySummaryUpdatedAt,
}: UsePlaygroundSessionHydrationParams) => {
  const applySnapshotMemory = useCallback(
    (patch: Awaited<ReturnType<typeof buildSessionSnapshotMemoryPatch>>) => {
      applySessionSnapshotMemoryPatch(patch, {
        setMemoryMetrics,
        setMemorySummary,
        setMemorySummaryUpdatedAt,
      });
    },
    [setMemoryMetrics, setMemorySummary, setMemorySummaryUpdatedAt],
  );

  const hydrateSessionMessages = useCallback(async (snapshotSessionId?: string) => {
    if (!authToken) {
      return;
    }

    const sid = snapshotSessionId ?? playgroundChatStreamSessionId;

    try {
      const snapshot = await requestSessionSnapshot({ sessionId: sid, authToken });
      const patch = await buildSessionSnapshotMemoryPatch(snapshot);

      setMessages(hydrateRenderableMessages(snapshot.messages));
      setLatestUserQuestion(getLatestUserQuestion(snapshot.messages));
      applySnapshotMemory(patch);
    } catch {
      // 历史会话回显失败时保留当前界面状态。
    }
  }, [
    applySnapshotMemory,
    authToken,
    playgroundChatStreamSessionId,
    setLatestUserQuestion,
    setMessages,
  ]);

  useEffect(() => {
    if (!authToken || hasRestorableDraft) {
      return;
    }

    void hydrateSessionMessages();
  }, [authToken, hasRestorableDraft, hydrateSessionMessages, playgroundChatStreamSessionId]);

  return {
    applySnapshotMemory,
    hydrateSessionMessages,
  };
};
