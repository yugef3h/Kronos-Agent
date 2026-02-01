import {
  NodeRunStatus,
  type NodeDebugBlockKind,
  type NodeRunStatus as NodeRunStatusType,
  type RunError,
} from './types.js'
import type { RunContext } from './runContext.js'

export type WorkflowNodeBlockKind = NodeDebugBlockKind

export type WorkflowNodePayload = {
  id: string
  type: WorkflowNodeBlockKind
  inputs?: Record<string, unknown>
  data?: Record<string, unknown>
}

export type NodeExecutionRequest = {
  runId: string
  appId: string
  node: WorkflowNodePayload
  context: RunContext
  branchHandleId?: string
}

export type NodeExecutionResult = {
  nodeId: string
  status: NodeRunStatusType
  startedAt: number
  finishedAt: number
  elapsedMs: number
  outputs?: Record<string, unknown>
  branchId?: string
  error?: RunError
}

export type NodeExecutor = (request: NodeExecutionRequest) => Promise<NodeExecutionResult>

export class NodeExecutorNotFoundError extends Error {
  readonly kind: WorkflowNodeBlockKind

  constructor(kind: WorkflowNodeBlockKind) {
    super(`No workflow node executor registered for "${kind}"`)
    this.name = 'NodeExecutorNotFoundError'
    this.kind = kind
  }
}

export class NodeExecutorRegistry {
  private readonly executors = new Map<WorkflowNodeBlockKind, NodeExecutor>()

  register(kind: WorkflowNodeBlockKind, executor: NodeExecutor): void {
    this.executors.set(kind, executor)
  }

  has(kind: WorkflowNodeBlockKind): boolean {
    return this.executors.has(kind)
  }

  get(kind: WorkflowNodeBlockKind): NodeExecutor | undefined {
    return this.executors.get(kind)
  }

  listKinds(): WorkflowNodeBlockKind[] {
    return [...this.executors.keys()]
  }

  async execute(request: NodeExecutionRequest): Promise<NodeExecutionResult> {
    const executor = this.executors.get(request.node.type)
    if (!executor) {
      throw new NodeExecutorNotFoundError(request.node.type)
    }

    const startedAt = Date.now()
    const result = await executor(request)
    const finishedAt = Date.now()

    return {
      ...result,
      nodeId: result.nodeId || request.node.id,
      startedAt: result.startedAt ?? startedAt,
      finishedAt: result.finishedAt ?? finishedAt,
      elapsedMs: result.elapsedMs ?? Math.max(0, finishedAt - startedAt),
      status: result.status ?? NodeRunStatus.Succeeded,
    }
  }
}

export const nodeExecutorRegistry = new NodeExecutorRegistry()

export const registerNodeExecutor = (
  kind: WorkflowNodeBlockKind,
  executor: NodeExecutor,
): void => {
  nodeExecutorRegistry.register(kind, executor)
}

export const executeWorkflowNode = (request: NodeExecutionRequest): Promise<NodeExecutionResult> =>
  nodeExecutorRegistry.execute(request)
