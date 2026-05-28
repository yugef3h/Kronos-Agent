type SessionMetricsSnapshot = {
  saveSuccessTotal: number;
  saveConflictTotal: number;
  loadTotal: number;
  lastConflictAt: number | null;
  lastConflictSessionId: string | null;
};

const metrics: SessionMetricsSnapshot = {
  saveSuccessTotal: 0,
  saveConflictTotal: 0,
  loadTotal: 0,
  lastConflictAt: null,
  lastConflictSessionId: null,
};

export const recordSessionLoad = (): void => {
  metrics.loadTotal += 1;
};

export const recordSessionSaveSuccess = (): void => {
  metrics.saveSuccessTotal += 1;
};

export const recordSessionSaveConflict = (params: {
  sessionId: string;
  expectedVersion: number;
  actualVersion: number;
}): void => {
  metrics.saveConflictTotal += 1;
  metrics.lastConflictAt = Date.now();
  metrics.lastConflictSessionId = params.sessionId;

  console.warn(
    `[sessionStore] version conflict sessionId=${params.sessionId} `
      + `expected=${params.expectedVersion} actual=${params.actualVersion}`,
  );
};

export const getSessionMetrics = (): SessionMetricsSnapshot => ({ ...metrics });
