export type VariableSelector = string[]

export type RunContainerFrame = {
  kind: 'loop' | 'iteration'
  nodeId: string
  index: number
}

export type RunContextInit = {
  runId: string
  appId: string
  inputs?: Record<string, unknown>
  sys?: Record<string, unknown>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const normalizeVariableSelector = (
  selector: VariableSelector | string,
): VariableSelector => {
  if (Array.isArray(selector)) {
    return selector.filter((segment) => typeof segment === 'string' && segment.length > 0)
  }

  return selector
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}

const readPath = (value: unknown, path: string[]): unknown => {
  let current: unknown = value

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined
    }

    current = current[segment]
  }

  return current
}

export class RunContext {
  readonly runId: string
  readonly appId: string
  readonly containerStack: RunContainerFrame[]

  private readonly sys: Record<string, unknown>
  private readonly nodeOutputs = new Map<string, Record<string, unknown>>()
  private readonly selectorIndex = new Map<string, unknown>()

  constructor(init: RunContextInit) {
    this.runId = init.runId
    this.appId = init.appId
    this.containerStack = []
    this.sys = {
      conversation_id: init.runId,
      ...(init.sys ?? {}),
      ...(init.inputs ?? {}),
    }

    this.rebuildSelectorIndex()
  }

  setSys(key: string, value: unknown): void {
    this.sys[key] = value
    this.rebuildSelectorIndex()
  }

  setNodeOutputs(nodeId: string, outputs: Record<string, unknown>): void {
    this.nodeOutputs.set(nodeId, { ...outputs })
    this.rebuildSelectorIndex()
  }

  set(selector: VariableSelector | string, value: unknown): void {
    const normalized = normalizeVariableSelector(selector)
    if (normalized.length === 0) {
      return
    }

    if (normalized[0] === 'sys') {
      const key = normalized[1]
      if (!key) {
        return
      }

      this.sys[key] = value
      this.rebuildSelectorIndex()
      return
    }

    const [nodeId, ...path] = normalized
    if (!nodeId) {
      return
    }

    const current = { ...(this.nodeOutputs.get(nodeId) ?? {}) }
    if (path.length === 0) {
      if (isRecord(value)) {
        this.nodeOutputs.set(nodeId, value)
      }

      this.rebuildSelectorIndex()
      return
    }

    let cursor: Record<string, unknown> = current
    for (let index = 0; index < path.length - 1; index += 1) {
      const segment = path[index]!
      const next = cursor[segment]
      if (!isRecord(next)) {
        cursor[segment] = {}
      }

      cursor = cursor[segment] as Record<string, unknown>
    }

    cursor[path[path.length - 1]!] = value
    this.nodeOutputs.set(nodeId, current)
    this.rebuildSelectorIndex()
  }

  get(selector: VariableSelector | string): unknown {
    const normalized = normalizeVariableSelector(selector)
    return this.selectorIndex.get(normalized.join('.'))
  }

  resolve(selector: VariableSelector): unknown {
    if (selector.length === 0) {
      return undefined
    }

    if (selector[0] === 'sys') {
      return readPath(this.sys, selector.slice(1))
    }

    const [nodeId, ...path] = selector
    if (!nodeId) {
      return undefined
    }

    const outputs = this.nodeOutputs.get(nodeId)
    if (!outputs) {
      return undefined
    }

    return readPath(outputs, path)
  }

  pushContainer(frame: RunContainerFrame): void {
    this.containerStack.push(frame)
  }

  popContainer(): RunContainerFrame | undefined {
    return this.containerStack.pop()
  }

  snapshot(): {
    sys: Record<string, unknown>
    nodeOutputs: Record<string, Record<string, unknown>>
    containerStack: RunContainerFrame[]
  } {
    return {
      sys: { ...this.sys },
      nodeOutputs: Object.fromEntries(this.nodeOutputs.entries()),
      containerStack: [...this.containerStack],
    }
  }

  private rebuildSelectorIndex(): void {
    this.selectorIndex.clear()

    for (const [key, value] of Object.entries(this.sys)) {
      this.selectorIndex.set(`sys.${key}`, value)
    }

    for (const [nodeId, outputs] of this.nodeOutputs.entries()) {
      this.indexNodeOutputs(nodeId, outputs, [nodeId])
    }
  }

  private indexNodeOutputs(nodeId: string, value: unknown, path: string[]): void {
    this.selectorIndex.set(path.join('.'), value)

    if (!isRecord(value)) {
      return
    }

    for (const [key, nested] of Object.entries(value)) {
      this.indexNodeOutputs(nodeId, nested, [...path, key])
    }
  }
}
