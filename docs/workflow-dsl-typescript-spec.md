# Dify Workflow DSL TypeScript Convention

## Scope

This document only describes the DSL contract for `workflow` mode.

It is intended for external projects that need to:

1. Generate a YAML file compatible with Dify import.
2. Understand which fields are authoritative.
3. Implement a local TypeScript type system that stays aligned with Dify.

## Source of Truth

The actual export/import contract is defined by backend code, not by the export modal.

Relevant source files:

- `web/app/components/workflow/dsl-export-confirm-modal.tsx`
- `api/services/app_dsl_service.py`
- `api/models/workflow.py`
- `web/app/components/workflow/update-dsl-modal.tsx`
- `api/tests/fixtures/workflow/simple_passthrough_workflow.yml`

The export modal only passes whether secrets should be included:

```tsx
const submit = () => {
  onConfirm(exportSecrets)
  onClose()
}
```

The actual DSL structure is assembled in `AppDslService.export_dsl()` and `Workflow.to_dict()`.

## Current Version

Current workflow DSL export version:

```ts
export const DIFY_WORKFLOW_DSL_VERSION = '0.6.0'
```

For new external integrations, generate `version: 0.6.0`.

## Top-Level YAML Shape

Workflow mode export is shaped like this:

```yaml
version: 0.6.0
kind: app
app:
  name: My Workflow
  mode: workflow
  icon: 🤖
  icon_type: emoji
  icon_background: '#FFEAD5'
  description: ''
  use_icon_as_answer_icon: false
workflow:
  graph:
    nodes: []
    edges: []
    viewport:
      x: 0
      y: 0
      zoom: 0.7
  features: {}
  environment_variables: []
  conversation_variables: []
  rag_pipeline_variables: []
dependencies: []
```

## TypeScript Types

Use the following TypeScript interfaces as the external alignment baseline.

```ts
export const DIFY_WORKFLOW_DSL_VERSION = '0.6.0'

export type DifyWorkflowDSL = {
  version: string
  kind: 'app'
  app: DifyAppMeta
  workflow: DifyWorkflowPayload
  dependencies: DifyDependency[]
}

export type DifyAppMeta = {
  name: string
  mode: 'workflow'
  icon?: string
  icon_type?: string
  icon_background?: string
  description?: string
  use_icon_as_answer_icon?: boolean
}

export type DifyWorkflowPayload = {
  graph: DifyWorkflowGraph
  features: DifyWorkflowFeatures
  environment_variables: DifyEnvironmentVariable[]
  conversation_variables: DifyConversationVariable[]
  rag_pipeline_variables: DifyRagPipelineVariable[]
}

export type DifyWorkflowGraph = {
  nodes: DifyWorkflowNode[]
  edges: DifyWorkflowEdge[]
  viewport?: DifyWorkflowViewport
}

export type DifyWorkflowViewport = {
  x: number
  y: number
  zoom: number
}

export type DifyNodeType =
  | 'start'
  | 'end'
  | 'llm'
  | 'if-else'
  | 'tool'
  | 'code'
  | 'template-transform'
  | 'knowledge-retrieval'
  | 'question-classifier'
  | 'variable-assigner'
  | 'parameter-extractor'
  | 'iteration'
  | 'loop'
  | 'http-request'
  | 'agent'
  | 'document-extractor'
  | 'list-operator'
  | 'note-transform'
  | 'assigner'
  | (string & {})

export type DifyCanvasNodeType = 'custom' | 'custom-note' | (string & {})

export type DifyWorkflowNode = {
  id: string
  type: DifyCanvasNodeType
  position: DifyXYPosition
  positionAbsolute?: DifyXYPosition
  sourcePosition?: 'right' | 'left' | 'top' | 'bottom' | string
  targetPosition?: 'right' | 'left' | 'top' | 'bottom' | string
  width?: number
  height?: number
  selected?: boolean
  dragging?: boolean
  zIndex?: number
  parentId?: string
  extent?: 'parent' | string
  data: DifyWorkflowNodeData
}

export type DifyXYPosition = {
  x: number
  y: number
}

export type DifyWorkflowNodeData = DifyWorkflowNodeDataBase & {
  type: DifyNodeType
}

export type DifyWorkflowNodeDataBase = {
  type: DifyNodeType
  title?: string
  desc?: string
  selected?: boolean
  variables?: DifyNodeVariableBinding[]
  outputs?: DifyEndOutput[]
  [key: string]: unknown
}

export type DifyStartNodeData = DifyWorkflowNodeDataBase & {
  type: 'start'
  title: string
  variables: DifyStartInputVariable[]
}

export type DifyEndNodeData = DifyWorkflowNodeDataBase & {
  type: 'end'
  title: string
  outputs: DifyEndOutput[]
}

export type DifyLLMNodeData = DifyWorkflowNodeDataBase & {
  type: 'llm'
  model?: {
    provider?: string
    name?: string
    mode?: string
    completion_params?: Record<string, unknown>
  }
  prompt_template?: Array<{
    id?: string
    role: string
    text: string
  }>
  context?: {
    enabled?: boolean
    variable_selector?: string[]
  }
  memory?: Record<string, unknown>
  vision?: Record<string, unknown>
}

export type DifyWorkflowEdge = {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
  type?: 'custom' | string
  selected?: boolean
  zIndex?: number
  data?: DifyWorkflowEdgeData
}

export type DifyWorkflowEdgeData = {
  sourceType?: string
  targetType?: string
  isInIteration?: boolean
  isInLoop?: boolean
  [key: string]: unknown
}

export type DifyWorkflowFeatures = {
  opening_statement?: string
  suggested_questions?: string[]
  retriever_resource?: {
    enabled?: boolean
  }
  sensitive_word_avoidance?: {
    enabled?: boolean
  }
  speech_to_text?: {
    enabled?: boolean
  }
  suggested_questions_after_answer?: {
    enabled?: boolean
  }
  text_to_speech?: {
    enabled?: boolean
    language?: string
    voice?: string
  }
  file_upload?: {
    enabled?: boolean
    allowed_file_types?: string[]
    allowed_file_extensions?: string[]
    allowed_file_upload_methods?: string[]
    number_limits?: number
    image?: {
      enabled?: boolean
      number_limits?: number
      transfer_methods?: string[]
    }
    fileUploadConfig?: Record<string, unknown>
  }
  [key: string]: unknown
}

export type DifyVariableValueType =
  | 'string'
  | 'secret'
  | 'number'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'object'
  | 'array[string]'
  | 'array[number]'
  | 'array[object]'
  | 'array[boolean]'
  | (string & {})

export type DifyEnvironmentVariable = {
  id?: string
  name: string
  description?: string
  selector?: string[]
  value_type: DifyVariableValueType
  value: unknown
}

export type DifyConversationVariable = {
  id?: string
  name: string
  description?: string
  selector?: string[]
  value_type: DifyVariableValueType
  value: unknown
}

export type DifyRagPipelineVariable = Record<string, unknown>

export type DifyStartInputVariable = {
  label: string
  variable: string
  type: string
  required?: boolean
  max_length?: number | null
  options?: string[]
  [key: string]: unknown
}

export type DifyNodeVariableBinding = {
  variable?: string
  value_selector?: string[]
  [key: string]: unknown
}

export type DifyEndOutput = {
  variable: string
  value_selector: string[]
  value_type?: string
  [key: string]: unknown
}

export type DifyDependency = Record<string, unknown>
```

## Field Semantics

### 1. Top-Level Required Fields

These fields should always be present:

```ts
type RequiredTopLevelFields = Pick<DifyWorkflowDSL, 'version' | 'kind' | 'app' | 'workflow'>
```

`dependencies` is strongly recommended even if it is an empty array.

### 2. Workflow Required Fields

These fields should always be present inside `workflow`:

```ts
type RequiredWorkflowFields = Pick<
  DifyWorkflowPayload,
  'graph' | 'features' | 'environment_variables' | 'conversation_variables' | 'rag_pipeline_variables'
>
```

### 3. Graph Required Fields

For import compatibility, `nodes` and `edges` are the core fields.

`viewport` is not the strictest backend minimum, but exported fixtures consistently contain it. For external generation, always include it.

### 4. Node Required Fields

At minimum, each node should include:

```ts
type RequiredNodeFields = Pick<DifyWorkflowNode, 'id' | 'type' | 'position' | 'data'>
```

For stable canvas rendering, also include:

- `positionAbsolute`
- `width`
- `height`
- `sourcePosition`
- `targetPosition`
- `selected`

### 5. Edge Required Fields

At minimum, each edge should include:

```ts
type RequiredEdgeFields = Pick<
  DifyWorkflowEdge,
  'id' | 'source' | 'target' | 'sourceHandle' | 'targetHandle'
>
```

For stable behavior, also include:

- `type: 'custom'`
- `data.sourceType`
- `data.targetType`
- `data.isInIteration`
- `data.isInLoop`
- `zIndex`

## Workflow Mode Special Rules

This document is only for `workflow` mode.

That means:

- `app.mode` must be `workflow`.
- Terminal nodes should use `end`, not `answer`.
- Frontend import validation rejects `answer` nodes in workflow mode.

In other words, this is valid:

```yaml
app:
  mode: workflow
```

And this is not valid for workflow mode:

```yaml
data:
  type: answer
```

## Variable Rules

Environment and conversation variables are built by backend variable factories.

For import compatibility, each variable should provide at least:

- `name`
- `value_type`
- `value`

Recommended full shape:

```yaml
- id: var_topic
  name: topic
  description: ''
  selector:
    - environment
    - topic
  value_type: string
  value: ''
```

Supported value types include:

- `string`
- `secret`
- `integer`
- `float`
- `boolean`
- `object`
- `array[string]`
- `array[number]`
- `array[object]`
- `array[boolean]`

For external workflow generation, defaulting to `string` is the safest path unless you explicitly need another type.

## Node Data Strategy

The outer DSL envelope is stable enough to type strictly.

The inner `node.data` payload is only partially uniform because each node type carries its own business schema. For external projects, the safest strategy is:

1. Type the outer envelope strictly.
2. Type common node data fields strictly.
3. Type node-specific config as open objects unless you are cloning a concrete node family.
4. Preserve unknown fields during read-modify-write.

Do not normalize away fields you do not understand.

## Minimal Workflow YAML Example

The following example is a minimal `workflow` mode file aligned with real workflow fixtures.

```yaml
version: 0.6.0
kind: app
app:
  name: echo
  mode: workflow
  icon: 🤖
  icon_type: emoji
  icon_background: '#FFEAD5'
  description: This workflow echoes the input query.
  use_icon_as_answer_icon: false
workflow:
  conversation_variables: []
  environment_variables: []
  rag_pipeline_variables: []
  features:
    file_upload:
      enabled: false
      image:
        enabled: false
        number_limits: 3
        transfer_methods:
          - local_file
          - remote_url
    opening_statement: ''
    retriever_resource:
      enabled: true
    sensitive_word_avoidance:
      enabled: false
    speech_to_text:
      enabled: false
    suggested_questions: []
    suggested_questions_after_answer:
      enabled: false
    text_to_speech:
      enabled: false
      language: ''
      voice: ''
  graph:
    edges:
      - id: start-1-source-end-1-target
        source: start-1
        sourceHandle: source
        target: end-1
        targetHandle: target
        type: custom
        zIndex: 0
        data:
          sourceType: start
          targetType: end
          isInIteration: false
          isInLoop: false
    nodes:
      - id: start-1
        type: custom
        position:
          x: 30
          y: 227
        positionAbsolute:
          x: 30
          y: 227
        selected: false
        sourcePosition: right
        targetPosition: left
        width: 244
        height: 90
        data:
          title: Start
          desc: ''
          selected: false
          type: start
          variables:
            - label: query
              variable: query
              type: text-input
              required: true
              max_length: null
              options: []
      - id: end-1
        type: custom
        position:
          x: 334
          y: 227
        positionAbsolute:
          x: 334
          y: 227
        selected: false
        sourcePosition: right
        targetPosition: left
        width: 244
        height: 90
        data:
          title: End
          desc: ''
          selected: false
          type: end
          outputs:
            - variable: query
              value_selector:
                - start-1
                - query
              value_type: string
    viewport:
      x: 0
      y: 0
      zoom: 0.7
dependencies: []
```

## Compatibility Recommendations for External Projects

When another project generates DSL for Dify workflow import, use these rules:

1. Fix the top-level structure first, then fill node-specific business data.
2. Keep `kind: app` and `app.mode: workflow` stable.
3. Always include `graph.viewport`.
4. Use `end` as the terminal node in workflow mode.
5. Keep `dependencies: []` even when empty.
6. Keep `environment_variables`, `conversation_variables`, and `rag_pipeline_variables` present even when empty.
7. Preserve unknown node fields instead of dropping them.
8. If you reference workspace resources such as datasets, tool credentials, or plugin subscriptions, do not assume the imported target workspace contains matching IDs.

## What This Document Does Not Freeze

This document freezes the stable outer DSL structure.

It does not claim that every node-specific `data` payload is permanently fixed across versions. Node-specific payloads may evolve. If you need strict compatibility for a specific node family, export a real Dify workflow using that node and treat that payload as the canonical sample.
