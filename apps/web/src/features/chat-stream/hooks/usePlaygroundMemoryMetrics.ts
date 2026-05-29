import { useCallback, useEffect, useRef } from 'react';

import { requestSessionSnapshot } from '../../../lib/api';
import { buildSessionSnapshotMemoryPatch } from '../applySessionSnapshot';
import type { SessionSnapshotMemoryPatch } from '../applySessionSnapshot';

type UsePlaygroundMemoryMetricsParams = {
  authToken: string;
  playgroundChatStreamSessionId: string;
  isStreaming: boolean;
  isOrchestrating: boolean;
  isAnalyzingImage: boolean;
  latestTimelineEventId: number;
  latestMessageSignature: string;
  applySnapshotMemory: (patch: SessionSnapshotMemoryPatch) => void;
};

export const usePlaygroundMemoryMetrics = ({
  authToken,
  playgroundChatStreamSessionId,
  isStreaming,
  isOrchestrating,
  isAnalyzingImage,
  latestTimelineEventId,
  latestMessageSignature,
  applySnapshotMemory,
}: UsePlaygroundMemoryMetricsParams) => {
  const metricsRefreshTimerRef = useRef<number | null>(null);

  const refreshMemoryMetrics = useCallback(async (snapshotSessionId?: string) => {
    if (!authToken) {
      return;
    }

    const sid = snapshotSessionId ?? playgroundChatStreamSessionId;

    try {
      const snapshot = await requestSessionSnapshot({ sessionId: sid, authToken });
      const patch = await buildSessionSnapshotMemoryPatch(snapshot);
      applySnapshotMemory(patch);
    } catch {
      // 会话指标刷新失败时保留当前展示，避免影响主流程。
    }
  }, [applySnapshotMemory, authToken, playgroundChatStreamSessionId]);

  const scheduleMemoryMetricsRefresh = useCallback((delayMs = 180) => {
    if (!authToken) {
      return;
    }

    if (metricsRefreshTimerRef.current !== null) {
      window.clearTimeout(metricsRefreshTimerRef.current);
    }

    metricsRefreshTimerRef.current = window.setTimeout(() => {
      metricsRefreshTimerRef.current = null;
      void refreshMemoryMetrics();
    }, delayMs);
  }, [authToken, refreshMemoryMetrics]);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    void refreshMemoryMetrics();
  }, [authToken, latestTimelineEventId, refreshMemoryMetrics]);

  useEffect(() => {
    if (!isStreaming) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void refreshMemoryMetrics();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isStreaming, refreshMemoryMetrics]);

  useEffect(() => {
    if (!authToken || isStreaming || isOrchestrating || isAnalyzingImage) {
      return undefined;
    }

    if (metricsRefreshTimerRef.current !== null) {
      window.clearTimeout(metricsRefreshTimerRef.current);
    }

    metricsRefreshTimerRef.current = window.setTimeout(() => {
      metricsRefreshTimerRef.current = null;
      void refreshMemoryMetrics();
    }, 180);

    return () => {
      if (metricsRefreshTimerRef.current !== null) {
        window.clearTimeout(metricsRefreshTimerRef.current);
        metricsRefreshTimerRef.current = null;
      }
    };
  }, [
    authToken,
    isAnalyzingImage,
    isOrchestrating,
    isStreaming,
    latestMessageSignature,
    refreshMemoryMetrics,
  ]);

  return {
    metricsRefreshTimerRef,
    refreshMemoryMetrics,
    scheduleMemoryMetricsRefresh,
  };
};
