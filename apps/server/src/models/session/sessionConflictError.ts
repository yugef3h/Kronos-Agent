export class SessionConflictError extends Error {
  readonly code = 'SESSION_VERSION_CONFLICT';

  constructor(
    readonly sessionId: string,
    readonly expectedVersion: number,
    readonly actualVersion: number,
  ) {
    super(
      `Session ${sessionId} version conflict: expected ${expectedVersion}, actual ${actualVersion}`,
    );
    this.name = 'SessionConflictError';
  }
}
