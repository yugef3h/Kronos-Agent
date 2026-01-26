import {
  WorkflowRunStatus,
  type CreateWorkflowRunInput,
  type UpdateWorkflowRunPatch,
  type WorkflowRunRecord,
} from './types.js'

export const DEFAULT_WORKFLOW_RUN_TTL_MS = 30 * 60 * 1000

const createRunId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `run_${Date.now().toString(36)}_${randomPart}`
}

export class WorkflowRunStore {
  private readonly runs = new Map<string, WorkflowRunRecord>()

  create(input: CreateWorkflowRunInput): WorkflowRunRecord {
    this.pruneExpired()

    const now = Date.now()
    const ttlMs = input.ttlMs ?? DEFAULT_WORKFLOW_RUN_TTL_MS
    const record: WorkflowRunRecord = {
      runId: createRunId(),
      appId: input.appId,
      status: input.status ?? WorkflowRunStatus.Queued,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ttlMs,
    }

    this.runs.set(record.runId, record)
    return { ...record }
  }

  get(runId: string): WorkflowRunRecord | undefined {
    this.pruneExpired()

    const record = this.runs.get(runId)
    if (!record) {
      return undefined
    }

    if (record.expiresAt <= Date.now()) {
      this.runs.delete(runId)
      return undefined
    }

    return { ...record }
  }

  update(runId: string, patch: UpdateWorkflowRunPatch): WorkflowRunRecord | undefined {
    const current = this.get(runId)
    if (!current) {
      return undefined
    }

    const now = Date.now()
    const next: WorkflowRunRecord = {
      ...current,
      status: patch.status ?? current.status,
      startedAt: patch.startedAt ?? current.startedAt,
      finishedAt: patch.finishedAt ?? current.finishedAt,
      updatedAt: now,
      expiresAt: patch.touchTtl === false
        ? current.expiresAt
        : now + (patch.ttlMs ?? DEFAULT_WORKFLOW_RUN_TTL_MS),
    }

    if (patch.error === null) {
      delete next.error
    } else if (patch.error !== undefined) {
      next.error = patch.error
    }

    this.runs.set(runId, next)
    return { ...next }
  }

  delete(runId: string): boolean {
    return this.runs.delete(runId)
  }

  listByAppId(appId: string): WorkflowRunRecord[] {
    this.pruneExpired()
    return [...this.runs.values()]
      .filter((record) => record.appId === appId)
      .map((record) => ({ ...record }))
  }

  pruneExpired(now = Date.now()): number {
    let removed = 0

    for (const [runId, record] of this.runs.entries()) {
      if (record.expiresAt > now) {
        continue
      }

      this.runs.delete(runId)
      removed += 1
    }

    return removed
  }

  clear(): void {
    this.runs.clear()
  }

  size(): number {
    this.pruneExpired()
    return this.runs.size
  }
}

export const workflowRunStore = new WorkflowRunStore()
