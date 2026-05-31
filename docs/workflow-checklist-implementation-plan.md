# Workflow Checklist Implementation Plan

## Goal

This document explains two things:

1. How Dify currently collects checklist data.
2. How to implement the same pattern in another project.

This is focused on the workflow canvas checklist shown in:

- `web/app/components/workflow/header/checklist.tsx`

## Current Dify Data Flow

The checklist itself does not own any business data.

It is only a view layer that renders the result of `useChecklist(nodes, edges)`.

The current collection path is:

```text
ReactFlow edges + workflow store nodes
  -> useChecklist(nodes, edges)
  -> connectivity analysis
  -> node-level validator execution
  -> variable reference validation
  -> required/start node checks
  -> ChecklistItem[]
  -> checklist popup rendering
```

## Where Checklist Data Comes From

### 1. Nodes

The checklist reads nodes from workflow store:

```ts
const nodes = useNodes()
```

This means the checklist always evaluates the current in-memory graph, not a backend snapshot.

### 2. Edges

The checklist reads edges from React Flow:

```ts
const edges = useEdges<CommonEdgeType>()
```

So checklist connectivity depends on the current canvas edge state.

### 3. Node metadata registry

The checklist does not hardcode validation rules for every node type.

Instead, it reads node metadata and validators from the node registry:

```ts
const { nodesMap: nodesExtraData } = useNodesMetaData()
```

This registry comes from `availableNodesMetaData` in the workflow hooks store.

Each node type can contribute:

- `metaData.isStart`
- `metaData.isRequired`
- `checkValid(payload, t, extra)`

That is the key abstraction in the current design.

### 4. External reference data

Some node validators need extra runtime context.

`useChecklist` loads those dependencies before calling validators, for example:

- built-in tools
- custom tools
- workflow tools
- trigger plugins
- strategy providers
- datasets detail
- embedding model list
- rerank model list
- data source list

These are used to build node-specific validation context.

## How `useChecklist` Builds Items

The hook returns a plain array:

```ts
export type ChecklistItem = {
  id: string
  type: string
  title: string
  toolIcon?: string
  unConnected?: boolean
  errorMessage?: string
  canNavigate: boolean
  disableGoTo?: boolean
}
```

The collection logic has five stages.

### Stage 1. Filter visual nodes

Only canvas business nodes are checked:

```ts
const filteredNodes = nodes.filter(node => node.type === CUSTOM_NODE)
```

This excludes non-business visual artifacts from checklist calculation.

### Stage 2. Compute connectivity

Connectivity is computed by `getValidTreeNodes(nodes, edges)`.

That function:

1. Finds all start-capable entry nodes.
2. Traverses outward using React Flow `getOutgoers`.
3. Marks all reachable nodes as valid.
4. Includes iteration/loop child nodes.
5. Returns both `validNodes` and `maxDepth`.

So `unConnected` in checklist does not mean "has no edge at all".

It means "is not reachable from any valid start node".

That is an important design choice.

### Stage 3. Run node-specific validator

For each node, checklist tries to find a validator in the registry:

```ts
const validator = nodesExtraData?.[node.data.type]?.checkValid
```

If present, it runs:

```ts
validator(checkData, t, moreDataForCheckValid)
```

The returned `errorMessage` becomes the node's checklist error.

Typical validation examples:

- model not configured
- required field missing
- tool auth missing
- missing tool parameter
- invalid strategy selection
- dataset configuration incomplete

### Stage 4. Validate variable references

For non-agent nodes, checklist also inspects used variables:

```ts
usedVars = getNodeUsedVars(node)
```

Then it compares them against current available vars for this node:

```ts
const availableVars = map[node.id].availableVars
```

If a referenced upstream node or variable cannot be resolved, checklist emits:

- `invalidVariable`

This is a second validation layer, separate from `checkValid`.

### Stage 5. Add structural requirements

After per-node checks, checklist adds graph-level requirements:

- missing start node
- missing required node type from metadata registry

These items are synthetic checklist entries. They are not tied to an existing canvas node.

Example:

```ts
{
  id: 'start-node-required',
  type: BlockEnum.Start,
  title: 'Start',
  errorMessage: 'need start node',
  canNavigate: false,
}
```

## Why Some Items Can Navigate and Some Cannot

Checklist navigation behavior is controlled by:

- `canNavigate`
- `disableGoTo`

Real node issues usually allow navigation.

Synthetic issues usually do not.

Plugin-missing nodes are a special case:

- they can still appear in checklist
- but Go To can be disabled when interaction should be blocked

## How Checklist Is Reused Elsewhere

Checklist is not only a popup UI.

It is reused as a validation source for run/publish flows.

### Run-time validation

`useWorkflowRunValidation()` simply wraps `useChecklist()` and blocks execution when the array is non-empty.

### Publish-time validation

`useChecklistBeforePublish()` performs a stricter version of the same validation pattern.

Compared with the popup checklist, publish-time validation also:

- recomputes reachability
- refetches dataset details
- checks max tree depth
- immediately emits toast errors and stops on first failure

So the current architecture is:

- checklist popup: aggregated warning list for user inspection
- before run: aggregated warning list reused as gate
- before publish: stricter procedural validation

## What Is Good About This Design

There are three solid ideas in the current design.

### 1. Validation is registry-driven

Node-specific rules are not hardcoded in the checklist component.

That keeps the checklist UI thin and allows every node package to own its own `checkValid` logic.

### 2. Connectivity is graph-based, not node-local

Reachability from entry nodes is treated as a workflow property, which is more correct than checking only local in-degree.

### 3. UI and gatekeeping share the same source

The same warning list can power:

- badge counts
- popup details
- run blocking

That reduces rule drift.

## Problems to Avoid in Another Project

If you reimplement this pattern elsewhere, avoid these mistakes:

### 1. Do not let the checklist component own business rules

Keep rules in a registry or validation layer.

### 2. Do not define `unconnected` as `incomingEdges.length === 0`

That is too naive for workflow graphs.

Use reachability from start nodes.

### 3. Do not mix data collection and rendering too early

Return a plain checklist data model first, then render it.

### 4. Do not silently skip variable validation

Invalid variable references are one of the highest-value checklist signals.

## Recommended Implementation for Another Project

Use a three-layer design.

```text
graph state layer
  -> checklist collector
  -> checklist UI / run gate / publish gate
```

## Proposed TypeScript Design

### 1. Graph types

```ts
export type WorkflowNodeId = string
export type WorkflowNodeType = string

export type WorkflowNode = {
  id: WorkflowNodeId
  type: 'custom' | string
  parentId?: string
  data: {
    type: WorkflowNodeType
    title?: string
    [key: string]: unknown
  }
}

export type WorkflowEdge = {
  id: string
  source: WorkflowNodeId
  target: WorkflowNodeId
  sourceHandle?: string
  targetHandle?: string
}
```

### 2. Registry types

```ts
export type NodeMeta = {
  isStart?: boolean
  isRequired?: boolean
  author?: string
  description?: string
}

export type NodeValidationContext = {
  language: string
  datasets?: unknown[]
  tools?: unknown[]
  triggers?: unknown[]
  strategies?: unknown[]
  availableVars?: AvailableVarNode[]
}

export type NodeValidationResult = {
  isValid: boolean
  errorMessage?: string
}

export type NodeDefinition = {
  metaData: NodeMeta
  checkValid?: (
    payload: Record<string, unknown>,
    ctx: NodeValidationContext,
  ) => NodeValidationResult
}

export type NodeRegistry = Record<string, NodeDefinition>
```

### 3. Checklist model

```ts
export type ChecklistSeverity = 'warning' | 'error'

export type ChecklistItem = {
  id: string
  nodeId?: string
  type: string
  title: string
  severity: ChecklistSeverity
  unConnected?: boolean
  errorMessage?: string
  canNavigate: boolean
  disableGoTo?: boolean
  source:
    | 'node-validator'
    | 'connectivity'
    | 'variable-reference'
    | 'required-node'
    | 'entry-node'
}
```

I strongly recommend adding `source` and `severity` even though Dify currently does not. They make downstream behavior much easier to control.

### 4. Collector function

```ts
export type ChecklistCollectorInput = {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  registry: NodeRegistry
  validationContext: NodeValidationContext
  getNodeUsedVars: (node: WorkflowNode) => string[][]
  getAvailableVarsMap: (nodes: WorkflowNode[]) => Record<string, AvailableVarsResult>
}

export type AvailableVarNode = {
  nodeId: string
  vars: Array<{ variable: string }>
}

export type AvailableVarsResult = {
  availableVars: AvailableVarNode[]
}
```

## Recommended Collector Algorithm

```ts
export function collectChecklistItems(input: ChecklistCollectorInput): ChecklistItem[] {
  const { nodes, edges, registry, validationContext, getNodeUsedVars, getAvailableVarsMap } = input

  const items: ChecklistItem[] = []
  const reachable = getReachableNodeIds(nodes, edges, registry)
  const availableVarsMap = getAvailableVarsMap(nodes)

  for (const node of nodes) {
    const def = registry[node.data.type]
    const title = String(node.data.title || node.data.type)

    const isStart = !!def?.metaData?.isStart
    const isReachable = reachable.has(node.id)
    if (!isReachable && !isStart) {
      items.push({
        id: `${node.id}:connectivity`,
        nodeId: node.id,
        type: String(node.data.type),
        title,
        severity: 'warning',
        unConnected: true,
        canNavigate: true,
        source: 'connectivity',
      })
    }

    const validator = def?.checkValid
    if (validator) {
      const result = validator(node.data as Record<string, unknown>, {
        ...validationContext,
        availableVars: availableVarsMap[node.id]?.availableVars || [],
      })

      if (!result.isValid && result.errorMessage) {
        items.push({
          id: `${node.id}:validator`,
          nodeId: node.id,
          type: String(node.data.type),
          title,
          severity: 'error',
          errorMessage: result.errorMessage,
          canNavigate: true,
          source: 'node-validator',
        })
      }
    }

    const usedVars = getNodeUsedVars(node)
    for (const selector of usedVars) {
      const [upstreamNodeId, variableName] = selector
      const available = availableVarsMap[node.id]?.availableVars || []
      const upstreamNode = available.find(v => v.nodeId === upstreamNodeId)
      const matched = upstreamNode?.vars.find(v => v.variable === variableName)
      if (!matched) {
        items.push({
          id: `${node.id}:var:${upstreamNodeId}:${variableName}`,
          nodeId: node.id,
          type: String(node.data.type),
          title,
          severity: 'error',
          errorMessage: 'Invalid variable reference',
          canNavigate: true,
          source: 'variable-reference',
        })
      }
    }
  }

  const startNodes = nodes.filter(node => registry[node.data.type]?.metaData?.isStart)
  if (startNodes.length === 0) {
    items.push({
      id: 'entry-node-required',
      type: 'start',
      title: 'Start',
      severity: 'error',
      errorMessage: 'A workflow entry node is required',
      canNavigate: false,
      source: 'entry-node',
    })
  }

  for (const [type, def] of Object.entries(registry)) {
    if (def.metaData?.isRequired && !nodes.some(node => node.data.type === type)) {
      items.push({
        id: `${type}:required`,
        type,
        title: type,
        severity: 'error',
        errorMessage: `Required node missing: ${type}`,
        canNavigate: false,
        source: 'required-node',
      })
    }
  }

  return dedupeChecklistItems(items)
}
```

## Recommended Reachability Function

This should match Dify's behavior conceptually.

```ts
export function getReachableNodeIds(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  registry: NodeRegistry,
): Set<string> {
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const outgoing = new Map<string, string[]>()

  for (const edge of edges) {
    const current = outgoing.get(edge.source) || []
    current.push(edge.target)
    outgoing.set(edge.source, current)
  }

  const startNodes = nodes.filter(node => registry[node.data.type]?.metaData?.isStart)
  const visited = new Set<string>()

  const walk = (nodeId: string) => {
    if (visited.has(nodeId))
      return
    visited.add(nodeId)

    for (const childId of outgoing.get(nodeId) || [])
      walk(childId)

    for (const childNode of nodes) {
      if (childNode.parentId === nodeId)
        visited.add(childNode.id)
    }
  }

  for (const node of startNodes)
    walk(node.id)

  return visited
}
```

## UI Layer Recommendations

Your checklist UI should stay dumb.

It should only:

1. Receive `ChecklistItem[]`.
2. Render a count badge.
3. Render title and messages.
4. Navigate when `canNavigate` is true.

Do not call validators directly from the popup component.

## Run/Publish Strategy

The cleanest design is:

- `collectChecklistItems()` for passive UI warnings
- `validateBeforeRun()` uses `collectChecklistItems()` and blocks on any `error`
- `validateBeforePublish()` may call stricter async validators on top of `collectChecklistItems()`

That gives you one baseline rule source and one publish-only hardening layer.

## Recommended File Layout for Another Project

```text
src/workflow/checklist/
  types.ts
  collect-checklist-items.ts
  reachability.ts
  validate-before-run.ts
  validate-before-publish.ts
  checklist-registry.ts
  ui/checklist-popover.tsx
```

## Migration Advice

If you are implementing this in another project, do it in this order:

1. Build the node registry with `metaData` and `checkValid`.
2. Implement reachability from start nodes.
3. Implement `ChecklistItem` collection.
4. Render the popup from collected items only.
5. Reuse the same collector for run-time blocking.
6. Add publish-only async validation later.

That sequence keeps the architecture clean and avoids a UI-first design that becomes hard to maintain.
