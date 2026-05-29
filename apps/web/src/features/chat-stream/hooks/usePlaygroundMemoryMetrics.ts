import { useCallback, useEffect, useRef } from 'react';

import { requestSessionSnapshot } from '../../../lib/api';
import { buildSessionSnapshotMemoryPatch } from '../applySessionSnapshot';
import type { SessionSnapshotMemoryPatch } from '../applySessionSnapshot';
import {
  MEMORY_METRICS_IDLE_DEBOUNCE_MS,
  MEMORY_METRICS_STREAM_POLL_MS,
} from '../constants';

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
  const streamPollTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const clearDebounce = useCallback(() => {
    if (metricsRefreshTimerRef.current !== null) {
      window.clearTimeout(metricsRefreshTimerRef.current);
      metricsRefreshTimerRef.current = null;
    }
  }, []);

  const clearStreamPoll = useCallback(() => {
    if (streamPollTimerRef.current !== null) {
      window.clearInterval(streamPollTimerRef.current);
      streamPollTimerRef.current = null;
    }
  }, []);

  const refreshMemoryMetrics = useCallback(async (snapshotSessionId?: string) => {
    if (!authToken) {
      return;
    }

    const isExplicitSession = snapshotSessionId !== undefined;
    if (!isExplicitSession && inFlightRef.current) {
      return;
    }

    const sid = snapshotSessionId ?? playgroundChatStreamSessionId;
    inFlightRef.current = true;

    try {
      const snapshot = await requestSessionSnapshot({ sessionId: sid, authToken });
      const patch = await buildSessionSnapshotMemoryPatch(snapshot);
      applySnapshotMemory(patch);
    } catch {
      // 会话指标刷新失败时保留当前展示，避免影响主流程。
    } finally {
      inFlightRef.current = false;
    }
  }, [applySnapshotMemory, authToken, playgroundChatStreamSessionId]);

  const scheduleMemoryMetricsRefresh = useCallback((delayMs = MEMORY_METRICS_IDLE_DEBOUNCE_MS) => {
    if (!authToken || isStreaming || isOrchestrating || isAnalyzingImage) {
      return;
    }

    clearDebounce();
    metricsRefreshTimerRef.current = window.setTimeout(() => {
      metricsRefreshTimerRef.current = null;
      void refreshMemoryMetrics();
    }, delayMs);
  }, [
    authToken,
    clearDebounce,
    isAnalyzingImage,
    isOrchestrating,
    isStreaming,
    refreshMemoryMetrics,
  ]);

  // 流式：仅 1s 轮询（不再对每个 timeline 事件立即请求）
  useEffect(() => {
    if (!authToken || !isStreaming) {
      clearStreamPoll();
      return undefined;
    }

    clearDebounce();
    void refreshMemoryMetrics();
    streamPollTimerRef.current = window.setInterval(() => {
      void refreshMemoryMetrics();
    }, MEMORY_METRICS_STREAM_POLL_MS);

    return () => {
      clearStreamPoll();
    };
  }, [authToken, clearDebounce, clearStreamPoll, isStreaming, refreshMemoryMetrics]);

  // 空闲：消息或 timeline 变化后防抖刷新
  useEffect(() => {
    if (!authToken || isStreaming || isOrchestrating || isAnalyzingImage) {
      return undefined;
    }

    scheduleMemoryMetricsRefresh();

    return () => {
      clearDebounce();
    };
  }, [
    authToken,
    clearDebounce,
    isAnalyzingImage,
    isOrchestrating,
    isStreaming,
    latestMessageSignature,
    latestTimelineEventId,
    scheduleMemoryMetricsRefresh,
  ]);

  const cancelAllScheduling = useCallback(() => {
    clearDebounce();
    clearStreamPoll();
  }, [clearDebounce, clearStreamPoll]);

  useEffect(() => () => {
    cancelAllScheduling();
  }, [cancelAllScheduling]);

  return {
    metricsRefreshTimerRef,
    refreshMemoryMetrics,
    scheduleMemoryMetricsRefresh,
    cancelAllScheduling,
  };
};
