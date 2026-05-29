import { useCallback, useEffect, useRef, useState } from 'react';

import { requestRecentSessions } from '../../../lib/api';
import type { RecentDialogueItem } from '../types';

const RECENT_SESSIONS_LIMIT = 10;

export const usePlaygroundHistoryPanel = (authToken: string) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historySwitchConfirmTarget, setHistorySwitchConfirmTarget] = useState<RecentDialogueItem | null>(null);
  const [recentDialogues, setRecentDialogues] = useState<RecentDialogueItem[]>([]);
  const historyPanelRef = useRef<HTMLDivElement | null>(null);

  const refreshRecentSessions = useCallback(async () => {
    if (!authToken) {
      return;
    }

    setIsHistoryLoading(true);
    try {
      const response = await requestRecentSessions({ authToken, limit: RECENT_SESSIONS_LIMIT });
      setRecentDialogues(response.items);
    } catch {
      setRecentDialogues([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [authToken]);

  const toggleHistoryPanel = useCallback(() => {
    setIsHistoryOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        void refreshRecentSessions();
      }
      return nextOpen;
    });
  }, [refreshRecentSessions]);

  useEffect(() => {
    if (!isHistoryOpen || historySwitchConfirmTarget) {
      return undefined;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!historyPanelRef.current?.contains(target)) {
        setIsHistoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [historySwitchConfirmTarget, isHistoryOpen]);

  return {
    historyPanelRef,
    historySwitchConfirmTarget,
    isHistoryLoading,
    isHistoryOpen,
    recentDialogues,
    refreshRecentSessions,
    setHistorySwitchConfirmTarget,
    setIsHistoryOpen,
    toggleHistoryPanel,
  };
};
