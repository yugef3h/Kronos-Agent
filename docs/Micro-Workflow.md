### 目标与约束
- **目标**：用 Node.js + React + 豆包 + LangGraph 落地最小工作流（画布编排 → 保存 DSL → 运行 → 回显状态），并让 LLM 读文档即可按设计实现。
- **约束**：先跑通 MVP，前端/后端都保持轻量；非功能性优先级：可视化交互顺滑 > 运行态可见 > 持久化。

### 本项目当前落地（已实现）
- **技术栈对齐**：前端为 React + TypeScript + React Router（`apps/web`），先用浏览器 `localStorage` 做最小持久化。
- **导航入口**：`工作流 -> 创建空白应用` 已接到 `/workflow/draft`。
- **应用创建**：在 `/workflow/draft` 提交应用名称/描述后，创建 `WorkflowAppRecord`，写入 `kronos_workflow_apps_v1`。
- **DSL 初始化**：创建时自动生成最小空白 DSL：`{ version: '0.1.0', nodes: [], edges: [], metadata }`。
- **应用空间展示**：`/workflow` 会读取本地应用列表，展示名称、ID、节点数、更新时间；创建成功后回显成功提示。
- **当前边界**：已打通“应用创建 + 本地持久化 + 列表可见”；画布编排、SSE 运行态、LangGraph 执行仍按下文计划推进。

### 开发依赖（最小集）
- **前端**：
  - `react`, `react-dom`, `reactflow`, `zustand`, `immer`, `classnames`（可选），`@types/react`, `@types/react-dom`, `@types/reactflow`。
  - 工具类：`lodash-es`（可选，用于深拷贝/去抖）、`uuid`（生成 id）。
- **运行事件/SSE**：浏览器原生 `EventSource`，若需 Node 端消费可用 `eventsource` 包。
- **后端（Node）**：
  - `typescript`, `ts-node`（或 `tsx`），`express`, `cors`, `body-parser`, `eventsource`/`ws`（SSE/WS 推送），`dotenv`。
  - LangGraph/LLM：`langchain`, `@langchain/langgraph`, `@langchain/core`，以及豆包 SDK（按供应商包名或 HTTP 调用）。
- **开发工具**：`eslint`, `prettier`, `vitest/jest`（可选）。

### 前端工作流框架（对标 Dify Web）
- **核心组件**：`ReactFlow` 负责画布；外层挂壳组件处理数据加载、特性开关、上下文。
- **状态管理**：用 `zustand/redux` 存 `nodes`/`edges`/`workflowRunningData`/`selection`，暴露 `syncDraft()`、`handleRun()` 等动作。
- **关键 hooks**（可按需裁剪）：
  - **节点交互**：`useNodesInteractions`（拖拽、对齐参考线、容器内约束、连线开始/结束、删除、保存草稿）。
  - **边交互**：`useEdgesInteractions`（创建、删除、悬浮状态、运行态着色）。
  - **选择交互**：`useSelectionInteractions`（框选、多选、批量移动）。
  - **变量推导**：`useWorkflowVariables`（推导当前节点可见变量、类型；供表单/提示词选择器用）。
  - **运行引擎**：`useWorkflowRun`（触发 run，发起 SSE，分发事件）。
  - **运行事件聚合**：`useWorkflowRunEvent`（处理 `workflow_started/node_started/iteration/loop/finished` 等，写回节点/边运行态）。

### 画布交互要点
- **拖拽**：`onNodeDragStart/Drag/DragStop`，拖拽中仅更新前端状态；`DragStop` 再 `syncDraft()`，避免频繁持久化。
- **连线**：`onConnect` 做约束（禁止自连、重复边、跨容器/迭代），边 id 规则 `${source}-${sourceHandle}-${target}-${targetHandle}`。
- **网格与对齐**：启用 `snapToGrid` 或手动 `gridSize`；拖拽时用对齐线（参考 `handleSetHelpline` 思路）提升摆放精度。
- **节点数据**：`id/type/position/data`，`data` 内含 `_runningStatus`、提示词、变量映射等；容器节点（loop/branch）需带 `parentId`。

### 变量管理（最简可用）
- **来源**：上游节点输出 + 全局环境变量 + 会话变量（可选）+ 工具输出 schema。
- **推导函数**：
  - `getNodeAvailableVars(nodeId)`：返回当前节点可见变量列表（名称、类型、来源节点）。
  - `getCurrentVariableType(selector)`：解析 selector 对应的变量类型。
- **映射方式**：在节点表单里用下拉/代码编辑器选择上游变量；保存到 `node.data.inputs` 或类似字段。
- **运行态传递**：LangGraph state 承载变量；节点执行后把输出写回 state，边只做拓扑。

### DSL 与持久化
- **结构**：`{ version, nodes: [], edges: [], metadata }`，与画布 1:1。边附带 `source/target/sourceHandle/targetHandle`，可扩展 `iteration_id/loop_id/parallel_id`。
- **接口**：`GET/PUT /workflow/:id` 读写 DSL；`syncDraft()` 在拖拽/连线停止后调用。

### 运行与事件（前后端契约）
- **后端**：`POST /workflow/:id/run` → 组装 DSL 为 LangGraph → 顺序/并行执行 → SSE 推送事件 `workflow_started/node_started/node_finished/workflow_finished`（可扩展 `node_failed/loop_started`）。
- **前端**：`EventSource` 订阅后，`useWorkflowRunEvent` 更新：
  - `workflowRunningData.tracing`
  - 节点 `data._runningStatus`
  - 相关边 `_sourceRunningStatus/_targetRunningStatus`
  - 可选：视口自动聚焦当前运行节点。

### 最小节点类型（MVP）
- `Trigger`：入口，输出初始变量。
- `LLM/Agent`：封装豆包调用（聊天/补全），接受 `prompt`+变量，输出 `text/json`。
- `End`：收尾，展示结果。
- **可选**：`Tool` 节点封装外部 API；后续再加 `If/Loop/Parallel`。

### LangGraph 集成要点
- DSL 节点 → LangGraph node 映射；边定义拓扑。
- State 结构：`{ vars, logs, parallel/loop ids }`，执行时在节点前后推事件。
- 并行/循环后续扩展时要在节点/边 data 带上 `iteration_id/parallel_id`，以便前端精准着色。

### MVP 验收路径
1. 画布可放置 `Trigger -> Agent -> End`，支持拖拽/连线/网格对齐，`DragStop/ConnectEnd` 后能保存 DSL。
2. 点击 Run：后端用 DSL 构建 LangGraph，按拓扑运行；Agent 节点实际调用豆包。
3. 前端收到 SSE：节点高亮，边状态更新，日志区展示 trace。
4. 刷新后草稿仍在（验证持久化）。

### 数据结构（TypeScript 草案）
```typescript
export type RunningStatus = 'idle' | 'running' | 'finished' | 'failed' | 'paused'

export interface WorkflowNode<TData = any> {
  id: string
  type: 'trigger' | 'agent' | 'end' | 'tool' | 'if' | 'loop' | 'parallel'
  position: { x: number; y: number }
  parentId?: string // 容器/循环/并行时使用
  data: TData & {
    label?: string
    inputs?: Record<string, any>
    outputs?: Record<string, any>
    _runningStatus?: RunningStatus
    _iterationId?: string
    _loopId?: string
    _parallelId?: string
  }
}

export interface WorkflowEdge {
  id: string // `${source}-${sourceHandle}-${target}-${targetHandle}`
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  data?: {
    sourceType?: string
    targetType?: string
    isInIteration?: boolean
    iteration_id?: string
    isInLoop?: boolean
    loop_id?: string
    parallel_id?: string
    _sourceRunningStatus?: RunningStatus
    _targetRunningStatus?: RunningStatus
  }
}

export interface WorkflowDSL {
  version: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  metadata?: Record<string, any>
}

export interface WorkflowRunEvent {
  event: 'workflow_started' | 'node_started' | 'node_finished' | 'node_failed' | 'workflow_finished'
  workflow_id: string
  node_id?: string
  iteration_id?: string
  loop_id?: string
  parallel_id?: string
  payload?: any
  timestamp: number
}
```

### DSL 文件用例（最小三节点）
```json
{
  "version": "0.1.0",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "Trigger",
        "outputs": { "user_query": "string" }
      }
    },
    {
      "id": "agent-1",
      "type": "agent",
      "position": { "x": 400, "y": 200 },
      "data": {
        "label": "Agent",
        "inputs": {
          "prompt": "You are a helpful assistant. User said: {{user_query}}"
        },
        "model": "doubao-pro",
        "outputs": { "reply": "string" }
      }
    },
    {
      "id": "end-1",
      "type": "end",
      "position": { "x": 700, "y": 200 },
      "data": {
        "label": "End",
        "inputs": { "result": "{{reply}}" }
      }
    }
  ],
  "edges": [
    {
      "id": "trigger-1-out-agent-1-in",
      "source": "trigger-1",
      "target": "agent-1",
      "sourceHandle": "out",
      "targetHandle": "in",
      "data": {
        "sourceType": "trigger",
        "targetType": "agent"
      }
    },
    {
      "id": "agent-1-out-end-1-in",
      "source": "agent-1",
      "target": "end-1",
      "sourceHandle": "out",
      "targetHandle": "in",
      "data": {
        "sourceType": "agent",
        "targetType": "end"
      }
    }
  ],
  "metadata": {
    "created_by": "dev",
    "description": "Minimal Trigger -> Agent -> End"
  }
}
```

### 前端实现片段（可直接抄用）
```typescript
// ReactFlow 挂载示例
const grid = 16
return (
  <ReactFlow
    nodes={nodes}
    edges={edges}
    nodeTypes={nodeTypes}
    edgeTypes={edgeTypes}
    snapToGrid
    snapGrid={[grid, grid]}
    fitView
    onNodeDragStart={handleNodeDragStart}
    onNodeDrag={handleNodeDrag}
    onNodeDragStop={handleNodeDragStop}
    onConnect={handleNodeConnect}
    onConnectStart={handleNodeConnectStart}
    onConnectEnd={handleNodeConnectEnd}
  />
)
```

```typescript
// store 关键动作草案（zustand）
const useWorkflowStore = create<{
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  workflowRunningData: { tracing: any[] }
  setNodes: (updater: Updater<WorkflowNode[]>) => void
  setEdges: (updater: Updater<WorkflowEdge[]>) => void
  syncDraft: () => Promise<void>
  handleRun: () => Promise<void>
}>(() => ({ nodes: [], edges: [], workflowRunningData: { tracing: [] }, setNodes, setEdges, syncDraft, handleRun }))
```

```typescript
// 运行事件消费示例
function useWorkflowRunEvent(eventSource: EventSource) {
  const { setNodes, setEdges } = useWorkflowStore()
  useEffect(() => {
    eventSource.onmessage = (msg) => {
      const evt = JSON.parse(msg.data) as WorkflowRunEvent
      if (evt.event === 'node_started') {
        setNodes(nodes => nodes.map(n => n.id === evt.node_id ? { ...n, data: { ...n.data, _runningStatus: 'running' } } : n))
      }
      if (evt.event === 'node_finished') {
        setNodes(nodes => nodes.map(n => n.id === evt.node_id ? { ...n, data: { ...n.data, _runningStatus: 'finished' } } : n))
      }
    }
  }, [eventSource, setNodes, setEdges])
}
```

### LangGraph 运行适配片段（Node.js）
```typescript
// 伪代码：把 DSL 转 LangGraph graph
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph'

async function buildGraph(dsl: WorkflowDSL) {
  const graph = new StateGraph({ channels: MessagesAnnotation })
  dsl.nodes.forEach(node => {
    if (node.type === 'agent') {
      graph.addNode(node.id, async (state) => {
        const userQuery = state.vars.user_query
        const reply = await callDoubao(node.data.model, node.data.inputs?.prompt, { user_query: userQuery })
        return { vars: { ...state.vars, reply } }
      })
    }
    if (node.type === 'trigger') {
      graph.addNode(node.id, async (state) => state)
    }
    if (node.type === 'end') {
      graph.addNode(node.id, async (state) => state)
    }
  })
  dsl.edges.forEach(edge => graph.addEdge(edge.source, edge.target))
  return graph.compile()
}
```

### 运行事件 payload 样例（SSE）
```
event: message
data: {"event":"workflow_started","workflow_id":"w1","timestamp":1710000000000}

event: message
data: {"event":"node_started","workflow_id":"w1","node_id":"agent-1","timestamp":1710000001000}

event: message
data: {"event":"node_finished","workflow_id":"w1","node_id":"agent-1","payload":{"reply":"hi"},"timestamp":1710000005000}

event: message
data: {"event":"workflow_finished","workflow_id":"w1","timestamp":1710000008000}
```

### 下一步落地
- 先搭 `reactflow + zustand` 骨架，注册节点/边类型与状态切片。
- 写最小 `syncDraft()` 与 `/workflow/:id` 接口对接。
- 落一个 `useWorkflowRun/useWorkflowRunEvent` 简化版，跑通 SSE 与运行态更新。
- 写 `dsl -> langgraph` 适配层 + 豆包调用封装，完成闭环。

---

### 全局分层（建议参考）
- **UI 壳层**：路由页面、Layout、数据加载（workflow DSL、feature flags、模型列表）。
- **画布层**：`ReactFlow` + 自定义节点/边，包含节点/边交互 hooks、对齐/网格、右键菜单。
- **业务逻辑层**：变量推导、表单校验、运行事件聚合、草稿同步、撤销/重做（可后置）。
- **后端协同层**：DSL 读写、运行触发、SSE/WS 事件推送、鉴权与限流。
- **执行层（LangGraph）**：将 DSL 映射为图，节点执行器调用豆包/工具，产出事件流。

### 前端模块清单（可裁剪）
- `components/workflow-app`：外层壳，加载 DSL、挂载 hooksStore、提供上下文。
- `components/workflow`：画布主组件，挂载 ReactFlow，绑定交互事件。
- `hooks/use-nodes-interactions`：节点拖拽、连线、删除、对齐线、容器约束、保存草稿。
- `hooks/use-edges-interactions`：边创建/删除、悬浮状态、运行态着色。
- `hooks/use-selection-interactions`：框选、多选、批量移动。
- `hooks/use-workflow-variables`：推导可见变量/类型，驱动表单/提示词选择器。
- `hooks/use-workflow-run`：发起运行、清理旧运行态、打开 SSE。
- `hooks/use-workflow-run-event`：消费 SSE，更新节点/边、tracing、视口。
- `store/workflow`：`nodes/edges/workflowRunningData/selection` + actions：`setNodes/setEdges/syncDraft/saveHistory`。

### 关键 Hooks 详解（对标可实现最小版）
- **useNodesInteractions**
  - 输入：`nodes/edges/setNodes/setEdges/readOnly/syncDraft/gridSize`。
  - 输出：`handleNodeDragStart/Drag/DragStop`、`handleNodeConnect`、`handleNodeConnectStart/End`、`handleDeleteNodes`。
  - 细节：拖拽中不写草稿；`DragStop` 时校验位置（容器内/网格 snap），再 `syncDraft()`；连线前校验自连、重复、父容器。
- **useEdgesInteractions**
  - 输入：`edges/setEdges/nodes`。
  - 输出：`handleEdgeDelete`、`setEdgeHover`、`updateEdgeRunningStatus`。
  - 细节：运行态把 `_sourceRunningStatus/_targetRunningStatus` 写回；删除需要同步历史/草稿。
- **useSelectionInteractions**
  - 支持框选、多选移动、对齐辅助线；批量更新坐标时同样在 `DragStop` 统一 `syncDraft()`。
- **useWorkflowVariables**
  - `getNodeAvailableVars(nodeId)`、`getCurrentVariableType(selector)`。
  - 数据来源：`workflowStore` 中的会话/环境/RAG/工具输出 + 上游节点 outputs。
- **useWorkflowRun**
  - `handleRun({ mode })`：清理运行态 → `syncDraft()` → 决定 run URL → `ssePost()`。
  - 可暴露 `stop/pause/resume` 占位。
- **useWorkflowRunEvent**
  - 订阅事件：`workflow_started/node_started/node_finished/node_failed/iteration/loop/parallel/workflow_finished`。
  - 更新：`workflowRunningData.tracing`、节点 `_runningStatus`、边 `_source/_targetRunningStatus`、视口居中。

### 画布交互细节补充
- **网格/对齐**：`snapToGrid` + `snapGrid=[16,16]`；自定义 `handleSetHelpline` 在 x/y 方向接近时显示参考线。
- **容器约束**：若存在 `loop/parallel` 容器，拖拽子节点时限制坐标在容器 bbox 内；跨容器连线拒绝。
- **边态着色**：运行态将 `_sourceRunningStatus`、`_targetRunningStatus` 映射为颜色（idle/ running/ finished/ failed）。
- **撤销/重做（可选）**：`saveStateToHistory(event)` 在关键动作后入栈；`undo/redo` 恢复 nodes/edges。

### 变量系统扩展
- **变量分类**：会话变量、环境变量、RAG 变量、工具输出、上游节点输出、系统变量（trace id）。
- **Selector 形态**：`{{var}}`、`{{node.output.field}}`、`{{tool.name.result}}`。
- **校验**：保存表单时校验变量是否在 `getNodeAvailableVars` 中；类型不匹配时提醒。
- **示例实现（片段）**：
```typescript
function getNodeAvailableVars(nodeId: string, dsl: WorkflowDSL) {
  const upstream = collectUpstreamNodes(nodeId, dsl.edges)
  const vars = [] as { name: string; type: string; from: string }[]
  upstream.forEach(n => {
    Object.entries(n.data.outputs || {}).forEach(([k, v]) => vars.push({ name: k, type: String(v), from: n.id }))
  })
  return vars
}
```

### DSL Schema 细化
- **节点必填**：`id/type/position`；`data.inputs`（可选）、`data.outputs`（推荐）、`parentId`（容器时）。
- **边必填**：`source/target`；可选 `sourceHandle/targetHandle`；`data.sourceType/targetType` 便于前端着色。
- **版本**：`version` 字段方便未来迁移。
- **metadata**：存放描述、创建人、feature flags、布局配置。
- **约束**：
  - 节点 id 唯一；边 id 唯一。
  - 同一对 `source-handle` 到 `target-handle` 只能出现一次。
  - 若 `parentId` 存在，父节点必须是容器类（loop/parallel/if）。

### 接口契约（HTTP/SSE）
- **GET /workflow/:id**：返回 `WorkflowDSL`。
- **PUT /workflow/:id**：保存 DSL，body 为 `WorkflowDSL`。
- **POST /workflow/:id/run**：触发运行，返回 `runId` 或直接升级 SSE。
- **GET /workflow/:id/run/stream?runId=xxx**：SSE 事件流。
- **SSE 事件字段**：`event`（类型）、`workflow_id`、`node_id`、`timestamp`、`payload`（可选）、`iteration_id/loop_id/parallel_id`（可选）。

### SSE 事件枚举与示例
- `workflow_started`
- `node_started`
- `node_finished`
- `node_failed`
- `workflow_finished`
- 可选：`iteration_started/iteration_finished/loop_started/loop_next/loop_completed/parallel_branch_started/parallel_branch_finished`

```json
{
  "event": "node_failed",
  "workflow_id": "w1",
  "node_id": "agent-1",
  "timestamp": 1710000010000,
  "payload": { "error": "model timeout" }
}
```

### 前后端运行时序（文本版）
1. 前端点击 Run → `handleRun()`：清运行态 → `syncDraft()` → POST /run。
2. 后端解析 DSL → 构建 LangGraph → 立刻推 `workflow_started`。
3. 执行节点前：推 `node_started`；执行后：推 `node_finished`（或 `node_failed`）。
4. 前端 `useWorkflowRunEvent`：更新节点 `_runningStatus`，边状态，写入 tracing，视口聚焦当前节点。
5. 所有节点完成：推 `workflow_finished`，前端收尾更新。

### LangGraph 适配细节
- **节点映射表**：
  - `trigger` → 初始化 state，不做模型调用。
  - `agent` → 调豆包 LLM，输入来自 state.vars + 节点 inputs。
  - `tool` → 调外部 API，输出写回 state.vars。
  - `end` → 终止节点，可记录结果。
- **边映射**：DSL 边直接 `graph.addEdge(source, target)`；若需条件/循环，再在节点函数中控制分支。
- **状态结构**：
```typescript
interface RuntimeState {
  vars: Record<string, any>
  logs: Array<{ node_id: string; event: string; timestamp: number; payload?: any }>
  iteration_id?: string
  loop_id?: string
  parallel_id?: string
}
```
- **事件钩子**：在节点执行前后调用 `emit(event)` 把 SSE 推给前端。

### Bean（豆包）调用封装建议
- 封装 `callDoubao(model, prompt, vars)`，内部做：插值 prompt、超时/重试、日志。
- 环境变量：`DOUBAO_API_KEY`、`DOUBAO_BASE_URL`。
- 错误分类：超时、配额、内容审查；在 `node_failed` 中返回错误码。

### 工程化与质量
- **类型**：保持 `WorkflowDSL`、`WorkflowNode`、`WorkflowEdge`、`WorkflowRunEvent` 全链路复用。
- **校验**：前端保存前 `validateDSL()`；后端入参也校验，防止脏数据。
- **测试**：
  - 单测：变量推导、DSL 校验、edge 唯一性、LangGraph 节点函数。
  - 集成：模拟 DSL，跑一次 LangGraph，断言事件序列。
- **性能**：
  - 画布大图时开启虚拟化（ReactFlow 内置 viewport culling）。
  - SSE 消息去抖（可按节点批次合并 UI 更新）。
- **可观测性**：前端 tracing + 控制台；后端日志打点 runId/nodeId/event。

### UX 细节清单
- 拖拽时显示对齐线、网格吸附；
- 节点 hover 展示 handles；
- 连线失败给出原因（自连/跨容器/重复）；
- 运行态：当前节点高亮、已完成节点置灰、失败节点标红；
- 日志面板展示 SSE trace，点击日志可聚焦节点；
- 草稿保存提示（成功/失败 toast）。

### 常见坑与规避
- **重复边/自连**：在 `handleNodeConnect` 先校验；
- **容器坐标**：子节点 position 需相对容器左上角或全局？保持一致性；
- **运行态残留**：新一次 run 前务必清理 `_runningStatus`；
- **变量缺失**：selector 不存在时要在表单期就报错；
- **SSE 断线**：前端自动重连，带上 `runId` 续跑；
- **大图性能**：节点 200+ 时禁用阴影/动画，减少重绘。

### 迁移到轻量项目的步骤
1. 复制数据结构与 DSL 校验函数。
2. 复制 hooks 片段：节点/边/运行事件核心逻辑。
3. 复制 ReactFlow 挂载模板 + store 草案。
4. 接后端四个接口：`GET/PUT /workflow/:id`、`POST /workflow/:id/run`、`GET /workflow/:id/run/stream`。
5. 替换模型调用为豆包实现。
6. 跑通示例 DSL，确认事件闭环。

### FAQ（给 LLM 用）
- **Q: 为什么连线失败？** A: 检查是否自连、重复、跨容器或 readOnly。
- **Q: 变量选择器为空？** A: 上游节点没有 outputs，或未在 `getNodeAvailableVars` 中推导到。
- **Q: 如何标记运行中的节点？** A: `_runningStatus` 写入节点 data，ReactFlow 节点组件根据状态着色。
- **Q: SSE 断了怎么办？** A: 前端重连并携带 `runId`，后端可支持从最新事件 offset 续播。
- **Q: 如何扩展条件/循环？** A: 在 DSL 中增加 `if/loop` 节点，LangGraph 节点函数决定下一跳，前端边 data 带 `iteration_id/loop_id`，事件中也附带。

### 附录：最小校验函数（示例）
```typescript
function validateDSL(dsl: WorkflowDSL) {
  const nodeIds = new Set<string>()
  dsl.nodes.forEach(n => {
    if (!n.id || !n.type) throw new Error('node missing id/type')
    if (nodeIds.has(n.id)) throw new Error('duplicate node id')
    nodeIds.add(n.id)
  })
  const edgeIds = new Set<string>()
  dsl.edges.forEach(e => {
    if (!e.id) throw new Error('edge missing id')
    if (edgeIds.has(e.id)) throw new Error('duplicate edge id')
    edgeIds.add(e.id)
    if (e.source === e.target) throw new Error('self edge not allowed')
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) throw new Error('edge endpoint missing')
  })
  return true
}
```

### 附录：前端运行态状态片段
```typescript
interface WorkflowRunningData {
  tracing: Array<WorkflowRunEvent>
  startedAt?: number
  finishedAt?: number
}
```

### 附录：LangGraph 执行器占位
```typescript
async function runWorkflow(dsl: WorkflowDSL, emit: (evt: WorkflowRunEvent) => void) {
  const graph = await buildGraph(dsl)
  emit({ event: 'workflow_started', workflow_id: 'w1', timestamp: Date.now() })
  await graph.invoke({ vars: {} }, {
    callbacks: [{
      handleNodeStart: (node_id) => emit({ event: 'node_started', workflow_id: 'w1', node_id, timestamp: Date.now() }),
      handleNodeEnd: (node_id, payload) => emit({ event: 'node_finished', workflow_id: 'w1', node_id, payload, timestamp: Date.now() }),
    }],
  })
  emit({ event: 'workflow_finished', workflow_id: 'w1', timestamp: Date.now() })
}
```

### 附录：运行日志/追踪结构建议
```typescript
interface TraceItem {
  id: string
  event: WorkflowRunEvent['event']
  node_id?: string
  timestamp: number
  payload?: any
}
```

### 附录：节点组件占位（React）
```typescript
function AgentNode({ data }: { data: WorkflowNode['data'] }) {
  const status = data._runningStatus || 'idle'
  return (
    <div className={`node agent ${status}`}>
      <div className="title">{data.label || 'Agent'}</div>
      <div className="status">{status}</div>
    </div>
  )
}
```

### 附录：快捷清单（复制即用）
- 事件名：`workflow_started/node_started/node_finished/node_failed/workflow_finished`。
- 节点状态：`idle/running/finished/failed/paused`。
- 边状态字段：`_sourceRunningStatus/_targetRunningStatus`。
- DSL 核心字段：`nodes[].id/type/position/data`，`edges[].source/target/sourceHandle/targetHandle/data`。
- 运行入口：`handleRun()` → `syncDraft()` → POST /run → SSE。
- UI 高亮：节点/边根据 `_runningStatus` 着色；日志面板展示 trace，点击定位节点。

---

（本文行数拉长到约 600 行，便于 LLM 迁移和实现。）