import {
  WorkflowRunStatus,
  type CreateWorkflowRunInput,
  type NodeDebugRunSnapshot,
  type SaveNodeDebugRunInput,
  type UpdateWorkflowRunPatch,
  type WorkflowRunRecord,
} from '../types/types.js'
import { nodeRunStatusToWorkflowRunStatus } from '../runner/workflowRunSummary.js'
import { buildUpdatedWorkflowRunRecord } from '../engine/workflowRunRecordPatch.js'

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
      kind: input.kind ?? 'draft',
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

    const next = buildUpdatedWorkflowRunRecord(current, patch)

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

  saveNodeDebugRun(input: SaveNodeDebugRunInput): WorkflowRunRecord {
    this.pruneExpired()

    const now = Date.now()
    const ttlMs = DEFAULT_WORKFLOW_RUN_TTL_MS
    const { request, result } = input
    const nodeDebug: NodeDebugRunSnapshot = {
      nodeId: result.nodeId,
      nodeType: request.node.type,
      status: result.status,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      elapsedMs: result.elapsedMs,
      ...(result.inputs ? { inputs: result.inputs } : {}),
      ...(result.outputs ? { outputs: result.outputs } : {}),
      ...(result.error ? { error: result.error } : {}),
    }

    const record: WorkflowRunRecord = {
      runId: createRunId(),
      appId: input.appId,
      kind: 'node_debug',
      status: nodeRunStatusToWorkflowRunStatus(result.status),
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ttlMs,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      ...(result.error ? { error: result.error } : {}),
      nodeDebug,
    }

    this.runs.set(record.runId, record)
    return { ...record }
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
