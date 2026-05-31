import {
  NodeRunStatus,
  type NodeDebugBlockKind,
  type NodeDebugExecutor,
  type NodeDebugRequest,
  type NodeDebugResult,
} from './types.js'

export class NodeDebugExecutorNotFoundError extends Error {
  readonly kind: NodeDebugBlockKind

  constructor(kind: NodeDebugBlockKind) {
    super(`No node debug executor registered for "${kind}"`)
    this.name = 'NodeDebugExecutorNotFoundError'
    this.kind = kind
  }
}

export class NodeDebugExecutorRegistry {
  private readonly executors = new Map<NodeDebugBlockKind, NodeDebugExecutor>()

  register(kind: NodeDebugBlockKind, executor: NodeDebugExecutor): void {
    this.executors.set(kind, executor)
  }

  has(kind: NodeDebugBlockKind): boolean {
    return this.executors.has(kind)
  }

  get(kind: NodeDebugBlockKind): NodeDebugExecutor | undefined {
    return this.executors.get(kind)
  }

  listKinds(): NodeDebugBlockKind[] {
    return [...this.executors.keys()]
  }

  async execute(request: NodeDebugRequest): Promise<NodeDebugResult> {
    const executor = this.executors.get(request.node.type)
    if (!executor) {
      throw new NodeDebugExecutorNotFoundError(request.node.type)
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

export const nodeDebugExecutorRegistry = new NodeDebugExecutorRegistry()

export const registerNodeDebugExecutor = (
  kind: NodeDebugBlockKind,
  executor: NodeDebugExecutor,
): void => {
  nodeDebugExecutorRegistry.register(kind, executor)
}

export const executeNodeDebug = (request: NodeDebugRequest): Promise<NodeDebugResult> =>
  nodeDebugExecutorRegistry.execute(request)
