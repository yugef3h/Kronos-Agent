import { useCallback } from 'react';
import { useSerialAsyncCallback } from './use-serial-async-callback';

type PersistCallbacks = {
  onSuccess?: () => void;
  onError?: () => void;
  onSettled?: () => void;
};

type PersistOptions<RefreshOptions> = {
  suppressRefreshOnError?: boolean;
  callbacks?: PersistCallbacks;
  refreshOnError?: RefreshOptions | false;
};

type RefreshLifecycleOptions = {
  skipApply?: boolean;
};

type UsePersistedDraftOptions<
  Snapshot,
  PersistPayload,
  PersistResult,
  RefreshResult,
  RefreshContext,
  RefreshOptions extends RefreshLifecycleOptions,
> = {
  shouldSkip?: () => boolean;
  debouncePersist: (fn: () => void) => void;
  createSnapshot: () => Snapshot | null;
  createPersistPayload: (snapshot: Snapshot) => PersistPayload;
  persist: (payload: PersistPayload) => Promise<PersistResult>;
  persistWithKeepalive?: (payload: PersistPayload) => void;
  onPersistSuccess?: (result: PersistResult, snapshot: Snapshot) => void;
  onPersistError?: (error: unknown, snapshot: Snapshot) => void;
  beforeRefresh?: (options?: RefreshOptions) => RefreshContext;
  refresh?: () => Promise<RefreshResult>;
  applyRefresh?: (result: RefreshResult, context: RefreshContext, options?: RefreshOptions) => void;
  onRefreshError?: (error: unknown, context: RefreshContext, options?: RefreshOptions) => void;
  afterRefresh?: (context: RefreshContext, options?: RefreshOptions) => void;
};

export const usePersistedDraft = <
  Snapshot,
  PersistPayload,
  PersistResult,
  RefreshResult,
  RefreshContext = void,
  RefreshOptions extends RefreshLifecycleOptions = RefreshLifecycleOptions,
>(options: UsePersistedDraftOptions<
  Snapshot,
  PersistPayload,
  PersistResult,
  RefreshResult,
  RefreshContext,
  RefreshOptions
>) => {
  const {
    shouldSkip,
    debouncePersist,
    createSnapshot,
    createPersistPayload,
    persist,
    persistWithKeepalive,
    onPersistSuccess,
    onPersistError,
    beforeRefresh,
    refresh,
    applyRefresh,
    onRefreshError,
    afterRefresh,
  } = options;

  const refreshLatest = useCallback(async (refreshOptions?: RefreshOptions) => {
    if (!refresh) {
      return undefined;
    }

    const context = beforeRefresh?.(refreshOptions) as RefreshContext;

    try {
      const result = await refresh();
      if (!refreshOptions?.skipApply) {
        applyRefresh?.(result, context, refreshOptions);
      }
      return result;
    } catch (error) {
      onRefreshError?.(error, context, refreshOptions);
      return undefined;
    } finally {
      afterRefresh?.(context, refreshOptions);
    }
  }, [afterRefresh, applyRefresh, beforeRefresh, onRefreshError, refresh]);

  const persistNow = useSerialAsyncCallback(async (persistOptions?: PersistOptions<RefreshOptions>) => {
    const snapshot = createSnapshot();
    if (!snapshot) {
      return undefined;
    }

    try {
      const result = await persist(createPersistPayload(snapshot));
      onPersistSuccess?.(result, snapshot);
      persistOptions?.callbacks?.onSuccess?.();
      return result;
    } catch (error) {
      onPersistError?.(error, snapshot);

      if (persistOptions?.refreshOnError) {
        await refreshLatest(persistOptions.refreshOnError);
      }

      persistOptions?.callbacks?.onError?.();
      return undefined;
    } finally {
      persistOptions?.callbacks?.onSettled?.();
    }
  }, shouldSkip);

  const schedulePersist = useCallback((persistOptions?: PersistOptions<RefreshOptions>) => {
    if (shouldSkip?.()) {
      return;
    }

    debouncePersist(() => {
      void persistNow(persistOptions);
    });
  }, [debouncePersist, persistNow, shouldSkip]);

  const persistWhenPageClose = useCallback(() => {
    if (shouldSkip?.()) {
      return;
    }

    if (!persistWithKeepalive) {
      return;
    }

    const snapshot = createSnapshot();
    if (!snapshot) {
      return;
    }

    persistWithKeepalive(createPersistPayload(snapshot));
  }, [createPersistPayload, createSnapshot, persistWithKeepalive, shouldSkip]);

  return {
    persistNow,
    schedulePersist,
    persistWhenPageClose,
    refreshLatest,
  };
};

type UseDraftBackupOptions<Snapshot> = {
  getBackup: () => Snapshot | undefined;
  setBackup: (snapshot?: Snapshot) => void;
  createSnapshot: () => Snapshot;
  restoreSnapshot: (snapshot: Snapshot) => void;
  onBackupCreated?: () => void;
};

export const useDraftBackup = <Snapshot>(options: UseDraftBackupOptions<Snapshot>) => {
  const {
    getBackup,
    setBackup,
    createSnapshot,
    restoreSnapshot,
    onBackupCreated,
  } = options;

  const backup = useCallback(() => {
    if (getBackup()) {
      return;
    }

    setBackup(createSnapshot());
    onBackupCreated?.();
  }, [createSnapshot, getBackup, onBackupCreated, setBackup]);

  const restore = useCallback(() => {
    const snapshot = getBackup();
    if (!snapshot) {
      return;
    }

    restoreSnapshot(snapshot);
    setBackup(undefined);
  }, [getBackup, restoreSnapshot, setBackup]);

  return {
    backup,
    restore,
  };
};
