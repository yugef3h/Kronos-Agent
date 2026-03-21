import type Redis from 'ioredis'
import {
  WorkflowRunStatus,
  type CreateWorkflowRunInput,
  type NodeDebugRunSnapshot,
  type SaveNodeDebugRunInput,
  type UpdateWorkflowRunPatch,
  type WorkflowRunRecord,
} from './types.js'
import { nodeRunStatusToWorkflowRunStatus } from './workflowRunSummary.js'
import { DEFAULT_WORKFLOW_RUN_TTL_MS } from './memoryWorkflowRunStore.js'
import { buildUpdatedWorkflowRunRecord } from './workflowRunRecordPatch.js'
import type { WorkflowRunStoreBackend } from './workflowRunStoreBackend.js'

const RUN_KEY_PREFIX = 'kronos:wf:run:'
const APP_RUNS_KEY_PREFIX = 'kronos:wf:app:'

const createRunId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `run_${Date.now().toString(36)}_${randomPart}`
}

const runKey = (runId: string) => `${RUN_KEY_PREFIX}${runId}`
const appRunsKey = (appId: string) => `${APP_RUNS_KEY_PREFIX}${appId}`

const expireSeconds = (expiresAt: number, now = Date.now()) =>
  Math.max(1, Math.ceil((expiresAt - now) / 1000))

const parseRecord = (raw: string): WorkflowRunRecord => JSON.parse(raw) as WorkflowRunRecord

export class RedisWorkflowRunStore implements WorkflowRunStoreBackend {
  constructor(private readonly redis: Redis) {}

  private async writeRecord(record: WorkflowRunRecord): Promise<void> {
    const ex = expireSeconds(record.expiresAt)
    await this.redis.set(runKey(record.runId), JSON.stringify(record), 'EX', ex)
    await this.redis.sadd(appRunsKey(record.appId), record.runId)
    await this.redis.expire(appRunsKey(record.appId), ex)
  }

  async create(input: CreateWorkflowRunInput): Promise<WorkflowRunRecord> {
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

    await this.writeRecord(record)
    return { ...record }
  }

  async get(runId: string): Promise<WorkflowRunRecord | undefined> {
    const raw = await this.redis.get(runKey(runId))
    if (!raw) {
      return undefined
    }

    const record = parseRecord(raw)
    if (record.expiresAt <= Date.now()) {
      await this.delete(runId)
      return undefined
    }

    return { ...record }
  }

  async update(
    runId: string,
    patch: UpdateWorkflowRunPatch,
  ): Promise<WorkflowRunRecord | undefined> {
    const current = await this.get(runId)
    if (!current) {
      return undefined
    }

    const next = buildUpdatedWorkflowRunRecord(current, patch)

    await this.writeRecord(next)
    return { ...next }
  }

  async delete(runId: string): Promise<boolean> {
    const raw = await this.redis.get(runKey(runId))
    const deleted = (await this.redis.del(runKey(runId))) > 0

    if (raw) {
      const record = parseRecord(raw)
      await this.redis.srem(appRunsKey(record.appId), runId)
    }

    return deleted
  }

  async listByAppId(appId: string): Promise<WorkflowRunRecord[]> {
    const runIds = await this.redis.smembers(appRunsKey(appId))
    const records: WorkflowRunRecord[] = []

    for (const runId of runIds) {
      const record = await this.get(runId)
      if (record) {
        records.push(record)
      }
    }

    return records
  }

  async saveNodeDebugRun(input: SaveNodeDebugRunInput): Promise<WorkflowRunRecord> {
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

    await this.writeRecord(record)
    return { ...record }
  }

  async pruneExpired(now = Date.now()): Promise<number> {
    const keys = await this.redis.keys(`${RUN_KEY_PREFIX}*`)
    let removed = 0

    for (const key of keys) {
      const raw = await this.redis.get(key)
      if (!raw) {
        continue
      }

      const record = parseRecord(raw)
      if (record.expiresAt > now) {
        continue
      }

      await this.delete(record.runId)
      removed += 1
    }

    return removed
  }

  async clear(): Promise<void> {
    const runKeys = await this.redis.keys(`${RUN_KEY_PREFIX}*`)
    const appKeys = await this.redis.keys(`${APP_RUNS_KEY_PREFIX}*`)
    const allKeys = [...runKeys, ...appKeys]

    if (allKeys.length > 0) {
      await this.redis.del(...allKeys)
    }
  }

  async size(): Promise<number> {
    await this.pruneExpired()
    const keys = await this.redis.keys(`${RUN_KEY_PREFIX}*`)
    return keys.length
  }
}
