# Dify Workflow 运行机制落地手册

本文目标是把 Dify 前端工作流编排里和运行有关的核心设计完整拆开，形成一份新项目也能直接落地的实现手册。

覆盖范围包括：

1. 测试运行如何发起。
2. 运行此步骤如何发起。
3. 运行期状态如何管理。
4. 各层 hook 分别负责什么。
5. 事件如何写回节点、边和右侧日志。
6. 迭代、循环、监听态、暂停态、人类输入态怎么建模。
7. 新项目照着做时，目录、数据结构、状态机、边界条件该怎么定。

## 1. 一句话先讲清楚

Dify 的工作流运行实现，本质上是一个“编辑态图结构”加一个“运行态事件流”的双层系统。

编辑态层只关心：

- 节点和边长什么样。
- 节点如何拖拽、连线、删除、改配置。
- 什么时候把当前 DSL 同步成草稿。

运行态层只关心：

- 当前任务有没有启动。
- 当前运行到哪个节点。
- 当前节点是 waiting、running、paused、failed 还是 succeeded。
- 当前边是不是已经被流经。
- 当前 tracing 日志、文本流、human input 表单、inspect vars 是什么。

这两层共用同一份 ReactFlow 图数据，但不走同一个更新入口。

编辑态更新来自用户操作。

运行态更新来自后端 SSE 事件和单节点运行接口返回。

这就是整个架构最关键的设计原则。

---

## 2. 设计目标

如果你要在一个新项目里复用这套机制，目标应该明确成下面 8 条：

1. 编辑操作和运行事件要解耦，不能让运行逻辑污染普通编辑逻辑。
2. 全量运行和单步运行都要落在同一套视觉状态模型上。
3. 节点状态和边状态都必须可追踪，不能只更新节点不更新边。
4. 运行中的中间结果必须能增量展示，不能只在结束时一次性刷结果。
5. 暂停、人类输入、Webhook/Plugin 监听等长生命周期状态必须有专门字段，而不是塞进一个 `loading`。
6. 迭代、循环、并行分支必须能精确定位，不然 tracing 会互相覆盖。
7. 草稿同步要节制，编辑态高频操作不能每次都直接打后端。
8. 任何时候都要能从 store 推导出 UI 应该怎么画，而不是依赖组件内部临时状态拼凑。

---

## 3. 先看总架构

### 3.1 主链路

编辑态主链路：

```text
页面路由
-> WorkflowApp
-> WorkflowAppMain
-> Workflow / ReactFlow
-> useNodesInteractions / useEdgesInteractions / useSelectionInteractions
-> workflow store
-> debounced / sync draft persistence
```

运行态主链路：

```text
Header Run Button / Node Single Run / Trigger Debug Run
-> useWorkflowStartRun 或 useOneStepRun
-> useWorkflowRun.handleRun 或 singleNodeRun / trigger run API
-> SSE / polling / single node response
-> useWorkflowRunEvent 聚合器
-> 各具体事件 hook
-> workflowRunningData + node.data + edge.data 更新
-> 画布 / 结果面板 / 日志面板 / 变量面板刷新
```

### 3.2 分层视角

建议在新项目里明确分成 6 层：

1. UI 触发层。
2. 运行编排层。
3. 传输层。
4. 事件分发层。
5. 运行态 store 层。
6. ReactFlow 视图投影层。

对应 Dify 里的典型映射：

| 层 | 代表文件 | 职责 |
| --- | --- | --- |
| UI 触发层 | `header/run-mode.tsx`、`node-control.tsx`、`panel-operator-popup.tsx` | 接用户点击，决定要运行什么 |
| 运行编排层 | `workflow-app/hooks/use-workflow-start-run.tsx`、`workflow-app/hooks/use-workflow-run.ts`、`nodes/_base/hooks/use-one-step-run.ts` | 组装参数、选择接口、初始化状态 |
| 传输层 | `ssePost`、`sseGet`、`post`、`singleNodeRun` | 发请求，收事件 |
| 事件分发层 | `hooks/use-workflow-run-event/use-workflow-run-event.ts` | 把一个大事件流拆到多个细粒度 handler |
| 运行态 store 层 | `workflow-slice.ts`、`node-slice.ts` | 持久保留运行态和 UI 联动态 |
| 视图投影层 | ReactFlow nodes / edges + panel UI | 根据状态字段表现颜色、高亮、日志、按钮禁用等 |

---

## 4. 为什么一定要把编辑态和运行态拆开

这是最容易被新项目做坏的地方。

很多项目会把“节点配置”和“节点当前运行状态”都塞在一个统一 reducer 里，看起来集中，实际问题很多：

1. 高频拖拽和高频 SSE 都打同一份大状态，渲染和维护都容易爆。
2. 运行态结束后常常忘记清理，编辑界面会残留脏状态。
3. 单步运行和全量运行会互相污染。
4. 人类输入暂停、Webhook 监听这类长生命周期状态很难建模。

Dify 的处理虽然没有完全独立两份图数据，但逻辑上已经分层了：

- 编辑态用交互 hooks 改图。
- 运行态用事件 hooks 改运行字段。
- 持久化只关心 DSL，不应该持久化纯运行字段。

新项目建议直接定一个规则：

1. 节点结构字段属于 DSL。
2. 节点运行字段属于 runtime overlay。
3. 草稿保存只落 DSL 字段。
4. runtime overlay 仅在内存中维护。

如果项目体量大，可以进一步把 runtime overlay 独立成：

```ts
type RuntimeNodeState = Record<string, {
  runningStatus?: NodeRunningStatus
  singleRunningStatus?: NodeRunningStatus
  waitingRun?: boolean
  runningBranchId?: string
  iterationLength?: number
  iterationIndex?: number
  loopLength?: number
  loopIndex?: number
  retryIndex?: number
  dimmed?: boolean
}>
```

Dify 当前是直接把大部分运行字段写进 `node.data`。

这是偏务实的做法。

优点是 ReactFlow 渲染直接吃 `data`。

缺点是 DSL 字段和运行字段混在一起，需要约定所有运行字段统一以下划线开头。

这也是 Dify 里 `_runningStatus`、`_singleRunningStatus`、`_waitingRun`、`_iterationLength`、`_loopIndex` 这套命名的原因。

---

## 5. 核心状态模型

这一节最重要。

你要落新项目，先把状态模型定对，后面的 hook 和 UI 才会顺。

### 5.1 全局运行状态

全局运行状态主要存放在 `workflow-slice.ts`。

关键字段有：

```ts
type PreviewRunningData = WorkflowRunningData & {
  resultTabActive?: boolean
  resultText?: string
  extraContentAndFormData?: Record<string, any>
}
```

再配合：

```ts
type WorkflowSliceShape = {
  workflowRunningData?: PreviewRunningData
  isListening: boolean
  listeningTriggerType: TriggerNodeType | null
  listeningTriggerNodeId: string | null
  listeningTriggerNodeIds: string[]
  listeningTriggerIsAll: boolean
}
```

### 5.2 `workflowRunningData` 的意义

这个字段不是“某个节点”的状态。

它是整次工作流运行的聚合容器。

典型内容包括：

1. `task_id`
2. `message_id`
3. `conversation_id`
4. `result`
5. `tracing`
6. `humanInputFormDataList`
7. `humanInputFilledFormDataList`
8. `resultText`
9. `resultTabActive`

对应类型可整理为：

```ts
type WorkflowRunningData = {
  task_id?: string
  message_id?: string
  conversation_id?: string
  result: {
    workflow_id?: string
    inputs?: string
    inputs_truncated: boolean
    process_data?: string
    process_data_truncated: boolean
    outputs?: string
    outputs_truncated: boolean
    outputs_full_content?: {
      download_url: string
    }
    status: string
    error?: string
    elapsed_time?: number
    total_tokens?: number
    created_at?: number
    created_by?: string
    finished_at?: number
    steps?: number
    showSteps?: boolean
    total_steps?: number
    files?: FileResponse[]
    exceptions_count?: number
  }
  tracing?: NodeTracing[]
  humanInputFormDataList?: HumanInputFormData[]
  humanInputFilledFormDataList?: HumanInputFilledFormData[]
}
```

### 5.3 `result.status` 表达的是“整次工作流状态”

`result.status` 用的是 `WorkflowRunningStatus`：

```ts
enum WorkflowRunningStatus {
  Waiting = 'waiting',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Stopped = 'stopped',
  Paused = 'paused',
}
```

这组状态只描述整个工作流，不描述单个节点。

对应语义：

- `waiting`: 理论上用于进入执行前的过渡态。
- `running`: 正在跑整条工作流。
- `succeeded`: 整条工作流结束且成功。
- `failed`: 整条工作流失败。
- `stopped`: 用户主动停止。
- `paused`: 因 human input 等原因暂停。

### 5.4 节点运行状态

节点运行状态用的是 `NodeRunningStatus`：

```ts
enum NodeRunningStatus {
  NotStart = 'not-start',
  Waiting = 'waiting',
  Listening = 'listening',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Exception = 'exception',
  Retry = 'retry',
  Stopped = 'stopped',
  Paused = 'paused',
}
```

这里比工作流状态更细。

尤其多了：

- `Listening`
- `Exception`
- `Retry`

它们分别服务于：

1. Trigger 节点等待外部触发。
2. 节点异常但不一定等于整条流程直接失败。
3. 节点在重试过程中的视觉反馈。

### 5.5 节点 `data` 上的运行字段

`CommonNodeType` 里和运行关系最密切的字段有：

```ts
type CommonNodeType<T = {}> = {
  _isSingleRun?: boolean
  _runningStatus?: NodeRunningStatus
  _runningBranchId?: string
  _singleRunningStatus?: NodeRunningStatus
  _iterationLength?: number
  _iterationIndex?: number
  _waitingRun?: boolean
  _retryIndex?: number
  isInIteration?: boolean
  iteration_id?: string
  _loopLength?: number
  _loopIndex?: number
  isInLoop?: boolean
  loop_id?: string
  _dimmed?: boolean
}
```

建议把这些字段理解成 5 类：

1. 全量运行状态字段。
2. 单步运行状态字段。
3. 分支选择字段。
4. 迭代循环字段。
5. 展示辅助字段。

详细解释如下。

### 5.6 `_runningStatus`

这是全量工作流运行时，节点在画布上的主状态。

它会被这些事件改写：

- `node_started`
- `node_finished`
- `iteration_started`
- `iteration_finished`
- `loop_started`
- `loop_finished`
- `human_input_required`

UI 上它通常决定：

- 节点边框颜色。
- 节点头部状态点。
- 是否显示 loading 动画。
- 是否展示已完成、失败、暂停样式。

### 5.7 `_singleRunningStatus`

这个字段只给“运行此步骤”用。

这是非常重要的设计。

如果没有它，单步运行就只能复用 `_runningStatus`，会带来两个问题：

1. 单步运行时会污染整条工作流正在执行的视觉语义。
2. 节点面板里需要显示“单步运行结果”，但全量运行未必在跑。

所以新项目一定要单独保留：

```ts
_singleRunningStatus?: NodeRunningStatus
```

单步运行面板、节点控制条、停止按钮，都应优先读这个字段。

### 5.8 `_isSingleRun`

这个字段不代表“正在跑”。

它更像一个 UI 意图标记，表示：

- 这个节点当前处于单步运行配置态。
- 右侧单步运行面板应该打开。
- 当前节点的 last run / settings tab 需要切换到合适上下文。

在 Dify 里，点击“运行此步骤”时首先写的是 `_isSingleRun: true`，而不是马上写 `_singleRunningStatus: running`。

这个拆分很合理。

因为用户可能还没填写单步运行输入参数。

### 5.9 `_waitingRun`

这是全量运行里非常实用的中间态字段。

`workflow_started` 时，所有节点先被标记为 `_waitingRun = true`。

含义不是“肯定会运行到”。

更准确地说，它表示：

- 当前流程已开始。
- 这个节点还没被具体事件推进到 running 或 finished。

当一个节点真正开始时，会把自己的 `_waitingRun = false`。

当 loop 开始下一轮时，它的子节点还会被重新打回 `waiting`。

这使得 UI 能区分：

1. 还没开始执行。
2. 已经在本轮执行队列里等待。
3. 当前正在执行。

### 5.10 `_runningBranchId`

这个字段专门解决“条件分支 / 分类分支 / human input action 分支”的边高亮问题。

典型来源：

- IfElse 节点完成后，记录 `selected_case_id`
- QuestionClassifier 节点完成后，记录 `class_id`
- HumanInput 节点完成后，记录 `__action_id`
- 节点异常且策略是 `failBranch` 时，记录失败分支

后续边更新时，会根据：

```ts
(!incomeNode.data._runningBranchId && edge.sourceHandle === 'source')
|| (incomeNode.data._runningBranchId && edge.sourceHandle === incomeNode.data._runningBranchId)
```

判断哪条边应该被点亮。

这说明：

边是否高亮，不是单靠 `target === 当前节点` 决定。

它还依赖源节点在该次运行里选择了哪个分支。

### 5.11 迭代与循环字段

用于迭代：

- `_iterationLength`
- `_iterationIndex`
- `isInIteration`
- `iteration_id`

用于循环：

- `_loopLength`
- `_loopIndex`
- `isInLoop`
- `loop_id`

其中：

- `isInIteration` / `isInLoop` 更偏结构属性。
- `iteration_id` / `loop_id` 更偏运行实例标识。
- `_iterationLength` / `_loopLength` 是容器级总量。
- `_iterationIndex` / `_loopIndex` 是当前进度。

### 5.12 `_dimmed`

这个字段在运行视觉上用于“弱化不会执行或当前非关注分支节点”。

新项目建议保留。

它能让复杂图在运行时更可读。

### 5.13 边运行字段

边的核心运行字段：

```ts
type CommonEdgeType = {
  _sourceRunningStatus?: NodeRunningStatus
  _targetRunningStatus?: NodeRunningStatus
  _waitingRun?: boolean
  isInIteration?: boolean
  iteration_id?: string
  isInLoop?: boolean
  loop_id?: string
}
```

这里面最关键的不是单个字段，而是“边要保留两端状态”。

### 5.14 为什么边要同时存 source 和 target 状态

因为边的视觉语义不是单值的。

典型情况：

1. 源节点已经 succeeded，但目标节点还在 waiting。
2. 源节点 running，目标节点还没开始。
3. 源节点 chosen branch 已经确定，目标节点正在 running。
4. 目标节点失败，但源节点本来成功。

如果边只存一个 status，你会很难画出“流经中”的感觉。

Dify 的设计是：

- `_sourceRunningStatus` 表示流从哪里来。
- `_targetRunningStatus` 表示流当前有没有进入目标。

这让边能表现成一种“连接上的过程态”。

### 5.15 监听态相关字段

这组字段在 webhook/plugin/schedule debug 特别重要：

- `isListening`
- `listeningTriggerType`
- `listeningTriggerNodeId`
- `listeningTriggerNodeIds`
- `listeningTriggerIsAll`

它们不是节点自身运行状态，而是“当前前端 UI 处于监听哪个 trigger 的调试会话”。

这是全局状态，不应该塞进某一个节点里。

### 5.16 为什么监听态必须全局管理

因为监听态会影响的不是单个节点组件，而是整套 UI：

1. Header Run 按钮文案会从 `running` 变成 `listening`。
2. 右侧变量面板可能要自动打开。
3. Stop 行为要作用于对应 trigger 调试控制器。
4. 多 trigger 同时调试时需要区分单节点和 all 模式。

所以监听态必须挂在 workflow 级 store 上。

---

## 6. store 怎么分

### 6.1 `workflow-slice.ts` 负责什么

这个 slice 更偏“整张工作流”和“全局运行态”。

与运行关系最大的字段有：

1. `workflowRunningData`
2. `isListening`
3. `listeningTriggerType`
4. `listeningTriggerNodeId`
5. `listeningTriggerNodeIds`
6. `listeningTriggerIsAll`

它还放了选择框、control mode、clipboard 等编辑态 UI 信息。

这说明 Dify 的 store 并不是严格按“运行 vs 编辑”物理分开，而是按业务域切片。

如果你做新项目，可以在保留 slice 模式的同时，再按语义拆成：

- `canvasSlice`
- `draftSlice`
- `runtimeSlice`
- `debugSlice`

这样后续更利于维护。

### 6.2 `node-slice.ts` 负责什么

这个 slice 更偏“节点层 UI 交互”和“单节点衍生运行态”。

运行相关字段有：

1. `showSingleRunPanel`
2. `iterTimes`
3. `loopTimes`
4. `iterParallelLogMap`
5. `pendingSingleRun`

这几个字段看起来杂，实际上各有明确用途。

### 6.3 `showSingleRunPanel`

控制单步运行面板是否显示。

它不是从 `_isSingleRun` 直接简单推导，而是结合校验结果和节点面板逻辑得到。

好处是：

1. 节点可以先进入“单步运行意图态”。
2. 校验未通过时不展示实际单步运行面板。
3. UI 能平滑控制面板开关。

### 6.4 `iterTimes` 和 `loopTimes`

这两个是运行过程中的计数器。

它们不是 DSL 字段。

也不是 tracing 的替代品。

作用只有一个：

给当前正在推进的 iteration / loop 事件提供递增索引，用于更新节点上 `_iterationIndex` 或 `_loopIndex`。

### 6.5 `iterParallelLogMap`

这是并行和迭代调试里最值得借鉴的字段。

类型：

```ts
Map<string, Map<string, NodeTracing[]>>
```

可以理解成：

```text
外层 key: 迭代或循环节点 ID
内层 key: 某一轮 index 或某个 parallel key
value: 这一轮的 tracing 列表
```

为什么不直接把所有 tracing 扔一个数组？

因为：

1. 并行分支会互相穿插。
2. 同一个迭代节点会有多轮子执行。
3. UI 展示“第 2 次迭代、第 3 个并行分支”的时候，需要定点读取。

新项目如果有并行执行日志面板，建议照这个思路建模，而不是只保留一个平铺数组。

### 6.6 `pendingSingleRun`

这个字段极有代表性。

定义是：

```ts
pendingSingleRun?: {
  nodeId: string
  action: 'run' | 'stop'
}
```

用途不是记录“某个节点当前在跑”。

它是一个跨组件的命令桥接器。

具体过程：

1. 节点浮层按钮 `node-control.tsx` 不直接调用单步运行 hook。
2. 它先写 `pendingSingleRun`。
3. 节点面板 `workflow-panel/index.tsx` 监听到自己的 `nodeId` 被命中。
4. 面板再决定调用 `handleSingleRun()` 还是 `handleStop()`。

这么设计的意义是：

1. 控制条是轻量按钮。
2. 真正的单步运行逻辑在面板上下文里，拿得到更多表单和日志状态。
3. 避免在多个地方各自挂复杂运行逻辑。

这是一种很实用的“store 命令分发”模式。

新项目里如果遇到“画布上的悬浮按钮要驱动侧边面板中的复杂流程”，可以直接复用这个思路。

---

## 7. hooks 分层图

这一节回答“hook 的作用到底怎么分”。

### 7.1 facade hooks

这一层只是从 `hooksStore` 里取方法。

代表：

- `hooks/use-workflow-run.ts`
- `hooks/use-workflow-start-run.tsx`

例如：

```ts
export const useWorkflowRun = () => {
  const handleRun = useHooksStore(s => s.handleRun)
  const handleStopRun = useHooksStore(s => s.handleStopRun)
  return { handleRun, handleStopRun }
}
```

这层不做业务逻辑。

价值在于：

1. 让组件不用知道真实实现在哪。
2. 支持在 WorkflowAppMain 一层注入不同实现。
3. 降低页面和底层运行实现的耦合。

### 7.2 app-level run hooks

这一层才是真正做运行编排的地方。

代表：

- `workflow-app/hooks/use-workflow-start-run.tsx`
- `workflow-app/hooks/use-workflow-run.ts`

职责：

1. 选择 run 模式。
2. 组织 run URL。
3. 组织 request body。
4. 初始化运行态。
5. 建立或恢复 SSE。
6. 处理中止控制器。
7. 调用事件聚合器。

### 7.3 event aggregator hook

代表：

- `hooks/use-workflow-run-event/use-workflow-run-event.ts`

它做的事情很简单但非常关键：

把一堆细粒度 hooks 聚合成一个统一对象返回。

这样 `use-workflow-run.ts` 里只要关心：

```ts
const {
  handleWorkflowStarted,
  handleWorkflowFinished,
  handleWorkflowNodeStarted,
  ...
} = useWorkflowRunEvent()
```

好处有三个：

1. 运行主流程代码保持可读。
2. 每种事件可以独立演进。
3. 某类事件有 bug 时可以局部修，不会污染全链路。

### 7.4 event handler hooks

这是最贴近“状态怎么落到画布上”的一层。

常见处理器包括：

- `useWorkflowStarted`
- `useWorkflowFinished`
- `useWorkflowFailed`
- `useWorkflowPaused`
- `useWorkflowNodeStarted`
- `useWorkflowNodeFinished`
- `useWorkflowNodeIterationStarted`
- `useWorkflowNodeIterationNext`
- `useWorkflowNodeIterationFinished`
- `useWorkflowNodeLoopStarted`
- `useWorkflowNodeLoopNext`
- `useWorkflowNodeLoopFinished`
- `useWorkflowNodeRetry`
- `useWorkflowNodeHumanInputRequired`
- `useWorkflowNodeHumanInputFormFilled`
- `useWorkflowNodeHumanInputFormTimeout`
- `useWorkflowTextChunk`
- `useWorkflowTextReplace`
- `useWorkflowAgentLog`

新项目里建议保持“一类事件一个 hook”的粒度。

不要写一个 800 行大 reducer 去处理所有事件。

### 7.5 node runtime hooks

代表：

- `nodes/_base/hooks/use-one-step-run.ts`

这层专门服务单步运行。

它不应该混进全量运行 hook。

否则：

1. 单步运行的参数面板逻辑会把全量运行搞乱。
2. Trigger 节点单步监听的特殊逻辑会污染普通 workflow run。
3. `_singleRunningStatus` 和 `_runningStatus` 容易打架。

### 7.6 draft sync hooks

代表：

- `use-nodes-sync-draft.ts`
- `use-node-data-update.ts`

这是编辑态和运行态衔接的关键辅助层。

它们做两件事：

1. 安全改 node data。
2. 决定这次改动要不要同步草稿。

这个层不能省。

因为“改 node data”这件事在工作流系统里太常见了。

如果每个组件都自己 `setNodes`，后面很快就不可维护。

---

## 8. 测试运行怎么实现

这里说的“测试运行”，对应 header 里的 Run 按钮和 trigger debug run。

### 8.1 UI 入口在哪里

主入口在：

- `web/app/components/workflow/header/run-mode.tsx`

这里可以看到：

1. 运行按钮平时展示 Run。
2. 运行中展示 loading 文案。
3. `isListening` 为真时文案显示 listening。
4. 运行中右侧出现 stop 按钮。

按钮文案逻辑：

```tsx
{isListening ? t('common.listening', { ns: 'workflow' }) : t('common.running', { ns: 'workflow' })}
```

说明 UI 已经显式区分：

- 运行态
- 监听态

这不是一个普通 loading。

### 8.2 入口为什么还要区分 trigger type

Run 菜单不是只支持“用户输入”一种触发。

它支持：

- `UserInput`
- `Schedule`
- `Webhook`
- `Plugin`
- `All`

这意味着新项目不能把“运行”写死成一个按钮直调一个接口。

更合理的抽象是：

```ts
type RunMode = 'user-input' | 'schedule' | 'webhook' | 'plugin' | 'all'
```

然后让入口 hook 负责把不同模式映射到不同 URL 和参数。

### 8.3 header 层做了什么校验

`run-mode.tsx` 里有个关键逻辑：

1. 读取 `warningNodes`
2. 用户选中某个 trigger 选项时，检查当前目标节点是否在 warning list 里
3. 如果不合法，toast 报错，不发起运行

也就是说：

运行前校验不一定都在 node panel 内完成。

workflow 入口也有一层 check。

新项目里建议做成两层：

1. 全局工作流级校验。
2. 节点级单步运行校验。

### 8.4 `useWorkflowStartRun` 做什么

外层 facade hook 只是转发。

真正的逻辑在：

- `workflow-app/hooks/use-workflow-start-run.tsx`

它负责：

1. 判断当前是否已在 running。
2. 取 start node 的 input vars。
3. 根据是否有 input vars 决定是直接跑还是先打开输入面板。
4. 对 trigger 模式预先写入监听态。
5. 调用 `doSyncWorkflowDraft()`。
6. 调用 `handleRun()`。

### 8.5 普通用户输入运行链路

`handleWorkflowStartRunInWorkflow()` 的主流程可以概括成：

1. 如果 `workflowRunningData.result.status === running`，直接 return。
2. 从 ReactFlow nodes 里找到 Start 节点。
3. 取 `startVariables` 和 file feature 配置。
4. 如果 debug panel 已开，则先取消。
5. 如果没有输入变量且没有文件输入需求，则：
   - 先同步草稿
   - 直接 `handleRun({ inputs: {}, files: [] })`
   - 打开 debug panel
   - 关闭 inputs panel
6. 如果需要输入，则：
   - 打开 debug panel
   - 打开 inputs panel

这说明：

“开始运行”并不一定立刻请求后端。

有时只是进入一个准备态 UI。

### 8.6 Trigger 运行链路

以 webhook 为例，`handleWorkflowTriggerWebhookRunInWorkflow()` 会做：

1. 检查 nodeId。
2. 如果已经 running，return。
3. 在 nodes 中找到目标 webhook trigger node。
4. 打开 debug panel，关闭 inputs panel。
5. 提前写：
   - `setListeningTriggerType(BlockEnum.TriggerWebhook)`
   - `setListeningTriggerNodeId(nodeId)`
   - `setListeningTriggerNodeIds([nodeId])`
   - `setListeningTriggerIsAll(false)`
6. 同步草稿。
7. 调 `handleRun(..., { mode: TriggerType.Webhook, webhookNodeId: nodeId })`

Schedule、Plugin、All 的模式同理。

### 8.7 为什么 trigger 入口要“先写监听态，再调用 handleRun”

因为 trigger debug 不是立刻进入标准 SSE 流。

它可能经历：

1. 轮询等待。
2. 监听外部回调。
3. 一段时间后才拿到真正的事件流。

如果不先把 UI 切到 listening，用户会觉得按钮没反应。

所以监听态是一个独立于“事件流是否已经开始”的前置 UI 状态。

这点对新项目特别重要。

---

## 9. `useWorkflowRun` 是整个运行引擎

这里指的是：

- `web/app/components/workflow-app/hooks/use-workflow-run.ts`

### 9.1 它做的第一件事

不是发请求。

而是清现场：

1. 把所有节点 `selected = false`
2. 把所有节点 `_runningStatus = undefined`
3. `await doSyncWorkflowDraft()`

为什么先清状态再同步草稿？

因为运行前要确保：

- 画布不残留上一次执行态
- 后端拿到的是最新 DSL

### 9.2 它如何决定请求 URL

它根据 `TriggerType` 和 app mode 选择不同 URL：

- plugin / webhook / schedule: `/apps/{appId}/workflows/draft/trigger/run`
- all: `/apps/{appId}/workflows/draft/trigger/run-all`
- advanced chat: `/apps/{appId}/advanced-chat/workflows/draft/run`
- workflow debug: `/apps/{appId}/workflows/draft/run`

所以新项目的 run engine 至少要支持两层分流：

1. 业务模式分流。
2. trigger 运行分流。

### 9.3 它如何决定 request body

普通运行：

```ts
requestBody = resolvedParams
```

Schedule：

```ts
requestBody = { node_id: scheduleNodeId }
```

Webhook：

```ts
requestBody = { node_id: webhookNodeId }
```

Plugin：

```ts
requestBody = { node_id: pluginNodeId }
```

All：

```ts
requestBody = { node_ids: allNodeIds }
```

这说明 run engine 最好接收统一 options，而不是让 UI 自己拼 body。

### 9.4 它如何初始化 `workflowRunningData`

无论普通运行还是 trigger 运行，都会先设置：

```ts
setWorkflowRunningData({
  result: {
    status: WorkflowRunningStatus.Running,
    inputs_truncated: false,
    process_data_truncated: false,
    outputs_truncated: false,
  },
  tracing: [],
  resultText: '',
})
```

区别在于 trigger 模式额外会：

- `setIsListening(true)`
- `setShowVariableInspectPanel(true)`
- 设置 trigger 相关 node ids / isAll

普通运行则会：

- `setIsListening(false)`
- 清空 trigger 监听信息

### 9.5 `abortControllerRef` 的作用

运行引擎有一个：

```ts
const abortControllerRef = useRef<AbortController | null>(null)
```

作用有三个：

1. 开新 run 前先 abort 老 run。
2. Stop 按钮需要统一终止当前传输。
3. Trigger debug 轮询和正式 SSE 都需要共享中断入口。

新项目不要把中断控制器放组件本地按钮状态里。

它属于运行引擎。

### 9.6 `clearListeningState()` 为什么要单独封装

运行结束、失败、完成、abort 时都要清：

- `isListening`
- `listeningTriggerType`
- `listeningTriggerNodeId`
- `listeningTriggerNodeIds`
- `listeningTriggerIsAll`

这是一组强一致字段。

封成一个方法很必要。

否则不同出口很容易漏清一个。

### 9.7 `wrappedOnError` 和 `wrappedOnCompleted`

这两个包装函数的本质是“把运行清理逻辑兜底集中化”。

error 时做：

1. 清 abort controller
2. 调 `handleWorkflowFailed()`
3. invalidate run history
4. 清 listening state
5. 回调给外部

completed 时做：

1. 清 abort controller
2. 清 listening state
3. 回调给外部

这类公共善后逻辑必须统一。

不要散在每个事件处理里。

### 9.8 普通 run 和 trigger debug run 的分叉

这是 `useWorkflowRun` 里最有价值的设计点之一。

逻辑上分两路：

1. 普通 workflow run 直接走 `ssePost(...)`
2. trigger debug run 先走 `runTriggerDebug(...)`

### 9.9 `runTriggerDebug()` 为什么不是直接 SSE

因为 trigger debug 接口有一个“等待外部真实触发”的阶段。

它会先返回 JSON：

```json
{ "status": "waiting", "retry_in": 2000 }
```

前端会：

1. 等待 `retry_in`
2. 继续轮询同一个接口
3. 一旦返回内容类型不再是 JSON，而是 SSE stream
4. 再把响应交给 `handleStream(...)`

这就是为什么 trigger 调试态必须有 `Listening` 概念，而不是一开始就 `Running`。

### 9.10 Trigger debug 的一个推荐抽象

新项目可以直接抽成：

```ts
async function startDebugSession(options) {
  while (true) {
    const response = await requestDebug(options)
    if (response.kind === 'waiting') {
      await delay(response.retryIn)
      continue
    }
    if (response.kind === 'stream') {
      return consumeSse(response.stream)
    }
    throw new Error(response.message)
  }
}
```

不要把 waiting 和 stream 混成一个回调地狱。

### 9.11 pause 后为什么要 `sseGet` 继续监听

在 `onWorkflowPaused` 里，Dify 做了一件很关键的事：

```ts
const url = `/workflow/${params.workflow_run_id}/events`
sseGet(url, {}, baseSseOptions)
```

意思是：

当前这次运行虽然 pause 了，但事件流并没有彻底终结。

前端要切到“继续监听这条运行记录后续事件”的模式。

这个设计很适合 human input 场景。

也就是说：

暂停不是结束。

暂停是“运行会话仍然存活，但等待外部补充输入”。

新项目要是做人工审核节点，也应该照这个思路处理。

---

## 10. 事件聚合器怎么理解

### 10.1 `useWorkflowRunEvent()` 的角色

它不做业务判断。

它只是把各个 hook 组装起来。

这样运行引擎可以把 SSE 每一类事件简单映射到对应 handler。

### 10.2 这种写法的好处

1. `useWorkflowRun.ts` 更像 orchestration layer，而不是细节垃圾场。
2. 每种事件的副作用边界清晰。
3. 测试时可以单测某个 handler，而不是每次都跑整条 SSE 流。
4. 未来增加新事件，如 `parallel_branch_started`，只要加 handler 并接入聚合器。

### 10.3 新项目建议

保留这个结构。

甚至建议再往前走一步，按事件名做一个字典：

```ts
const workflowRunEventHandlers = {
  workflow_started: handleWorkflowStarted,
  workflow_finished: handleWorkflowFinished,
  node_started: handleWorkflowNodeStarted,
  node_finished: handleWorkflowNodeFinished,
}
```

这样 transport 层和业务层之间接口更稳定。

---

## 11. 运行期状态怎么落到画布上

这一节直接回答文档原来的核心问题。

### 11.1 落到画布上，不是一次赋值，而是三路并发更新

每个关键事件通常会同时更新：

1. `workflowRunningData`
2. ReactFlow nodes
3. ReactFlow edges

如果只更新其中之一，UI 一定会有残缺。

### 11.2 `workflow_started`

对应 hook：`useWorkflowStarted`

它做的事情：

1. 如果当前是 paused 恢复，只把整条 workflow 状态改回 running。
2. 否则重置 `iterParallelLogMap`。
3. 把 `task_id` 和 workflow result 写入 `workflowRunningData`。
4. 清 `resultText`。
5. 所有节点打上：
   - `_waitingRun = true`
   - `_runningBranchId = undefined`
6. 所有边打上：
   - `_sourceRunningStatus = undefined`
   - `_targetRunningStatus = undefined`
   - `_waitingRun = true`

这一手非常关键。

它把画布整体推入“本轮执行准备态”。

### 11.3 `node_started`

对应 hook：`useWorkflowNodeStarted`

它会：

1. 把 node tracing 写入或更新到 `workflowRunningData.tracing`
2. 视口自动居中当前节点
3. 把该节点设成：
   - `_runningStatus = running`
   - `_waitingRun = false`
4. 找到所有流入这节点的边
5. 根据源节点的 `_runningBranchId` 判断当前哪条入边该点亮
6. 更新这些边：
   - `_sourceRunningStatus = sourceNode._runningStatus`
   - `_targetRunningStatus = running`
   - `_waitingRun = false`

这一步体现了 Dify 的一个重要原则：

节点开始时，边状态不是简单全改，而是只改实际选中的入边。

### 11.4 视口自动居中为什么也属于运行态逻辑

因为运行时用户真正关心的是“当前执行到哪”。

所以 `node_started`、`iteration_started`、`loop_started` 都会尝试 `setViewport(...)`。

这属于运行时可观测性的一部分，不只是 UI 动画。

### 11.5 `node_finished`

对应 hook：`useWorkflowNodeFinished`

它会：

1. 更新 tracing 中对应项的最终数据。
2. 把当前节点 `_runningStatus = data.status`。
3. 视节点类型写 `_runningBranchId`：
   - IfElse -> `selected_case_id`
   - QuestionClassifier -> `class_id`
   - HumanInput -> `__action_id`
   - Exception 且策略是 failBranch -> 失败分支
4. 把所有入边的 `_targetRunningStatus = data.status`

注意一个细节：

这里更新的是入边，不是出边。

原因很合理。

出边真正何时变亮，取决于后续哪个节点开始执行。

### 11.6 `workflow_finished`

对应 hook：`useWorkflowFinished`

它会：

1. 把最终 result 写回 `workflowRunningData.result`
2. 从 outputs 中抽出文件列表
3. 如果输出只有一个 string 字段，则：
   - `resultTabActive = true`
   - `resultText = 该字符串`

这说明运行结果面板不是简单绑定 `outputs` 原始对象。

它还做了适配层。

### 11.7 `workflow_failed`

对应 hook：`useWorkflowFailed`

只做一件关键事：

```ts
draft.result.status = WorkflowRunningStatus.Failed
```

为什么这么轻？

因为节点级失败细节往往已经在 `node_finished`、`error` 等阶段写进 tracing 了。

workflow failed 主要是整条流程收口。

### 11.8 `workflow_paused`

对应 hook：`useWorkflowPaused`

只把：

```ts
draft.result.status = WorkflowRunningStatus.Paused
```

真正跟 human input 表单、节点 pause 状态相关的数据，是另一个事件写的。

### 11.9 `human_input_required`

对应 hook：`useWorkflowNodeHumanInputRequired`

它会：

1. 把表单 schema 或表单数据写入 `humanInputFormDataList`
2. 把 tracing 中当前节点状态改成 paused
3. 把当前节点 `_runningStatus = paused`

这里有一句注释非常重要：

```ts
// Notice: Human input required !== Workflow Paused
```

它提醒我们：

节点需要 human input，和整条 workflow status 什么时候变 paused，不一定是同一时刻或同一语义。

新项目也应该避免把这两个概念混掉。

### 11.10 `text_chunk`

对应 hook：`useWorkflowTextChunk`

它会：

1. `resultTabActive = true`
2. `resultText += text`

这说明最终结果面板支持边生成边展示。

如果你做聊天工作流或者 agent 工作流，这个机制非常重要。

### 11.11 `iteration_started`

对应 hook：`useWorkflowNodeIterationStarted`

它会：

1. tracing push 一条 running 记录
2. `setIterTimes(DEFAULT_ITER_TIMES)`
3. 自动居中视口
4. 当前迭代节点：
   - `_runningStatus = running`
   - `_iterationLength = iterator_length`
   - `_waitingRun = false`
5. 当前迭代节点的入边：
   - `_sourceRunningStatus = source running status`
   - `_targetRunningStatus = running`
   - `_waitingRun = false`

### 11.12 `iteration_next`

对应 hook：`useWorkflowNodeIterationNext`

它会：

1. 读取当前 `iterTimes`
2. 把节点 `_iterationIndex = iterTimes`
3. 再 `setIterTimes(iterTimes + 1)`

也就是说：

“第几轮迭代”的 UI 不是后端直接推所有信息，而是前端借助计数器维护的。

### 11.13 `iteration_finished`

对应 hook：`useWorkflowNodeIterationFinished`

它会：

1. 更新 tracing 对应项
2. 重置 `iterTimes`
3. 当前节点 `_runningStatus = data.status`
4. 所有入边 `_targetRunningStatus = data.status`

### 11.14 `loop_started`

对应 hook：`useWorkflowNodeLoopStarted`

逻辑和 iteration started 类似，但字段换成 `_loopLength`。

### 11.15 `loop_next`

对应 hook：`useWorkflowNodeLoopNext`

它做了两个很有意思的动作：

1. 当前 loop 节点 `_loopIndex = data.index`
2. 所有 `parentId === 当前 loop 节点 id` 的子节点：
   - `_waitingRun = true`
   - `_runningStatus = waiting`

这一步相当于把 loop 的子图重新推回“待执行”状态。

没有这一手，下一轮循环的子节点视觉上会残留上一次运行结果。

### 11.16 `loop_finished`

对应 hook：`useWorkflowNodeLoopFinished`

更新 tracing、节点 `_runningStatus`、入边 `_targetRunningStatus`。

### 11.17 总结一句

运行状态落到画布上，不是某一个统一 reducer 的事。

它是：

- workflow 级状态负责结果和 tracing 聚合
- node 级状态负责节点视觉
- edge 级状态负责连线流向
- viewport 负责执行焦点

这四件事一起发生，用户才会觉得“当前执行过程真的在画布上流动”。

---

## 12. “运行此步骤”怎么实现

### 12.1 入口不是一个，是两个

入口 A：节点面板弹窗里的“运行此步骤”

- 文件：`panel-operator-popup.tsx`

入口 B：节点顶部悬浮控制条上的播放按钮

- 文件：`node-control.tsx`

这两个入口都能触发单步运行，但走法不完全一样。

### 12.2 面板弹窗入口做了什么

`panel-operator-popup.tsx` 中逻辑是：

1. `handleNodeSelect(id)`
2. `handleNodeDataUpdate({ id, data: { _isSingleRun: true } })`
3. `handleSyncWorkflowDraft(true)`
4. `onClosePopup()`

也就是说：

它不直接跑。

它只是把节点切进“单步运行准备态”，并强制同步草稿。

为什么这里要同步草稿？

因为用户可能刚刚改完这个节点配置，马上点“运行此步骤”。

单步运行应该基于最新 DSL。

### 12.3 节点控制条入口做了什么

`node-control.tsx` 里逻辑是：

1. 判断当前是不是 single running
2. 如果正在 single running，则 action = `stop`
3. 否则 action = `run`
4. `setInitShowLastRunTab(true)`
5. `setPendingSingleRun({ nodeId: id, action })`
6. `handleNodeSelect(id)`

它也不直接调用 `useOneStepRun`。

而是通过 store 发命令。

### 12.4 真正执行单步运行的是谁

真正执行者在：

- `nodes/_base/components/workflow-panel/index.tsx`
- `nodes/_base/hooks/use-one-step-run.ts`

其中 panel 层会监听：

```ts
if (!pendingSingleRun || pendingSingleRun.nodeId !== id) return
if (pendingSingleRun.action === 'run') handleSingleRun()
else handleStop()
setPendingSingleRun(undefined)
```

这一步说明：

单步运行是“面板上下文驱动”的，不是“悬浮按钮直接驱动”的。

### 12.5 为什么单步运行适合挂在面板上下文

因为单步运行会涉及：

1. 输入变量表单
2. last run tab
3. inspect vars 刷新
4. trigger 监听
5. 运行结果显示
6. 暂停恢复
7. stop 按钮

这些都更像“节点调试面板”的职责，而不是一个小播放按钮的职责。

### 12.6 `use-one-step-run.ts` 的职责范围

这个 hook 很大，但职责很统一：

它是“单节点调试引擎”。

它负责：

1. 校验节点配置。
2. 推导可运行输入。
3. 处理 start node 和普通 node 的不同入参格式。
4. 调普通单节点运行 API。
5. 调 iteration / loop 的单节点 SSE API。
6. 调 trigger 节点的单步调试 API。
7. 管理 `_singleRunningStatus`。
8. 刷新 inspect vars。
9. 维护单步运行结果列表。

### 12.7 单步运行前的校验

`use-one-step-run.ts` 会按节点类型选择 `checkValid`：

- LLM
- Knowledge Retrieval
- IfElse
- Code
- Template Transform
- Question Classifier
- HTTP Request
- Tool
- Variable Assigner
- Parameter Extractor
- Iteration
- Document Extractor
- Loop
- Human Input

也就是说：

单步运行不是只看用户有没有输入参数。

它还要看节点配置本身是否合法。

### 12.8 `checkValidWrap()` 的意义

它不仅返回是否 valid。

还会：

1. 失败时把 `_isSingleRun` 置回 false
2. toast 错误信息

这说明单步运行 UI 打开与否，也受校验结果影响。

### 12.9 单步运行时如何处理节点状态

真正执行 `handleRun(submitData)` 时，会先：

1. `updateNodeInspectRunningState(id, true)`
2. 如果是 trigger node，`startTriggerListening()`
3. 否则 `stopTriggerListening()`
4. 更新节点：
   - `_isSingleRun = false`
   - `_singleRunningStatus = listening 或 running`

这里有个细节很重要：

trigger node 单步运行初始态不是 `running`，而是 `listening`。

### 12.10 普通节点单步运行

如果节点不是 iteration、loop、trigger：

1. Start 节点会把 `query`、`files`、`inputs` 重新组装
2. 其他节点则用 `inputs = submitData`
3. 调 `singleNodeRun(flowType, flowId, id, postData)`

这是非常适合复用到新项目的一层抽象。

建议新项目也保留：

- 工作流级运行接口
- 单节点运行接口

而不是只提供一个统一大接口。

### 12.11 Trigger 节点单步运行

Schedule 单步运行：

1. 调 `/apps/{flowId}/workflows/draft/nodes/{id}/trigger/run`
2. 成功后设 `_singleRunningStatus = succeeded`
3. 失败则设 `_singleRunningStatus = failed`

Webhook 单步运行：

1. 反复调同一个 trigger/run 接口
2. 如果返回 `waiting`，按 `retry_in` 继续轮询
3. 真正准备好后，设 `_singleRunningStatus = listening`
4. 支持 abort 和 timeout 清理

Plugin 单步运行：

逻辑与 webhook 类似，也是 waiting 轮询模式。

### 12.12 iteration / loop 单步运行

这里没有走普通 `singleNodeRun`。

而是走单节点 SSE：

- `getIterationSingleNodeRunUrl(...)`
- `getLoopSingleNodeRunUrl(...)`

原因很简单：

迭代和循环单步运行本身也是一个“有内部多个子事件”的执行过程。

一次普通 HTTP 返回不够表达它的过程态。

### 12.13 单步运行结束后的 inspect vars 刷新

`setRunResult()` 里有一段很关键的逻辑：

1. 调 `fetchNodeInspectVars(flowType, flowId, id)`
2. `appendNodeInspectVars(id, vars, nodes)`
3. `updateNodeInspectRunningState(id, false)`
4. 如果本次成功：
   - invalid last run
   - 如果是 start 或 trigger 节点，刷新 sys vars
   - 刷新 conversation vars

也就是说：

单步运行不仅是跑一下节点。

它还承担“把新的变量值推回调试面板”的职责。

这对新项目非常重要。

如果没有这套刷新，用户会觉得单步运行没效果，因为面板里的变量值还是旧的。

### 12.14 单步运行建议状态机

新项目可以按下面状态机来实现：

```text
idle
-> prepare
-> validating
-> running 或 listening
-> paused 或 succeeded 或 failed 或 stopped
```

其中：

- `prepare` 对应 `_isSingleRun = true`
- `running/listening` 对应 `_singleRunningStatus`
- `paused` 对应某些特殊节点或面板保留状态

---

## 13. Hook 职责逐个说明

这一节按“你写新项目时应该怎么拆 hook”来讲。

### 13.1 `useWorkflowStartRun`

职责：决定“要不要开始跑”和“怎么开始跑”。

它不应该直接处理事件流。

它应该负责：

1. 根据 UI 当前上下文决定是开输入面板还是直接跑。
2. 根据 trigger 类型选择入口。
3. 在必要时预写 UI 状态，如 listening panel。
4. 在真正运行前确保草稿已同步。

### 13.2 `useWorkflowRun`

职责：承接一次完整工作流运行会话。

它应该负责：

1. 重置旧运行态。
2. 建立中断控制器。
3. 发 SSE 或 waiting-polling 请求。
4. 把事件交给事件聚合器。
5. 做统一善后。

### 13.3 `useWorkflowRunEvent`

职责：把所有细粒度事件处理函数拼成一个对象。

它本身不应该包含复杂逻辑。

### 13.4 `useWorkflowStarted`

职责：初始化本轮工作流运行态。

关键效果：

1. 写 task_id。
2. 重置 iterParallelLogMap。
3. 所有节点进入 waiting。
4. 所有边进入 waiting。

### 13.5 `useWorkflowNodeStarted`

职责：把“当前执行焦点”落到画布。

关键效果：

1. tracing push/update。
2. 当前节点 running。
3. 入边变亮。
4. 自动居中。

### 13.6 `useWorkflowNodeFinished`

职责：把“当前节点执行结果”写回画布和 tracing。

关键效果：

1. 记录最终 status。
2. 记录 branch 选择。
3. 入边随之完成。

### 13.7 `useWorkflowNodeIterationStarted`

职责：把迭代容器推进到 running，并记录总轮数。

### 13.8 `useWorkflowNodeIterationNext`

职责：推进当前迭代索引。

### 13.9 `useWorkflowNodeIterationFinished`

职责：收尾当前迭代容器，并重置迭代计数器。

### 13.10 `useWorkflowNodeLoopStarted`

职责：把循环容器推进到 running，并记录总循环数。

### 13.11 `useWorkflowNodeLoopNext`

职责：推进 loop index，并把 loop 子节点重新打回 waiting。

### 13.12 `useWorkflowNodeLoopFinished`

职责：收尾循环容器。

### 13.13 `useWorkflowPaused`

职责：把整条 workflow status 标记为 paused。

### 13.14 `useWorkflowNodeHumanInputRequired`

职责：保存 human input schema/data，并把目标节点置为 paused。

### 13.15 `useWorkflowTextChunk`

职责：增量拼装结果文本。

### 13.16 `useNodeDataUpdate`

职责：提供统一 node.data 更新入口。

很重要的一点：

它分成：

- `handleNodeDataUpdate`
- `handleNodeDataUpdateWithSyncDraft`

不要把“更新节点 data”和“同步草稿”绑死成一件事。

### 13.17 `useNodesSyncDraft`

职责：统一“什么时候同步草稿”。

支持：

- 同步立即保存
- debounced 保存
- page close 保存

### 13.18 `useOneStepRun`

职责：处理单节点调试会话，从输入到结果到 inspect vars 全链路负责。

---

## 14. Dify 当前实现里最值得保留的关键细节

### 14.1 运行状态字段统一前缀 `_`

这是一个小但重要的约定。

它让你一眼就能区分：

- DSL 原生字段
- UI/运行时临时字段

### 14.2 单步运行和全量运行分两套状态

这一点必须保留。

### 14.3 Trigger 的 `listening` 状态独立存在

这一点也必须保留。

### 14.4 `pendingSingleRun` 作为跨组件命令桥

这点很巧。

新项目如果也有 node toolbar 和 side panel 的协同，可以直接复用。

### 14.5 `iterParallelLogMap` 单独建模

不要偷懒只用 tracing 数组。

复杂执行流必须分桶。

### 14.6 `human_input_required` 和 `workflow_paused` 拆开

这个语义拆分非常对。

### 14.7 节点开始时自动聚焦画布

这不是锦上添花，是 workflow 可观测性的核心体验。

### 14.8 运行前总是先同步草稿

这条规范建议写死。

不然用户经常会跑到“视觉上已修改，但后端用的还是旧 DSL”。

### 14.9 Trigger debug 支持 waiting -> stream 两阶段

这一点不是细节，是 trigger 调试能不能成立的关键。

### 14.10 单步运行结束后主动刷新 inspect vars

这点决定调试体验是否闭环。

---

## 15. Dify 当前实现里值得在新项目避免的坑

这一节不是代码 review，而是给新项目的规避建议。

### 15.1 不要用 truthy 判断 tracing index

`useWorkflowNodeStarted` 里有这样的判断：

```ts
const currentIndex = tracing.findIndex(...)
if (currentIndex && currentIndex > -1) {
  ...
} else {
  ...
}
```

如果 `currentIndex === 0`，第一个条件是 false，会误走 else。

新项目应该写成：

```ts
if (currentIndex > -1) {
  ...
}
```

### 15.2 不要把 DSL 同步和运行字段保存混起来

运行字段通常不应该写回后端草稿。

### 15.3 不要只维护节点状态不维护边状态

这样画布会失去“流动”感。

### 15.4 不要把 trigger waiting 当成 running

用户会误解系统已经真正开始执行。

### 15.5 不要把 pause 当成 finish

pause 后仍需继续监听会话。

### 15.6 不要让单步运行直接和悬浮按钮强耦合

复杂输入、日志和变量刷新更适合挂在 panel 上下文。

---

## 16. 新项目可直接采用的数据结构

这一节给一版更适合新项目的建议型结构。

### 16.1 顶层 runtime store

```ts
export type RuntimeStore = {
  session?: WorkflowSession
  listening: ListeningState
  tracing: WorkflowTraceBucket
  inspect: InspectState
  singleRun: SingleRunState
}
```

### 16.2 工作流会话

```ts
export type WorkflowSession = {
  taskId?: string
  workflowId?: string
  status: WorkflowRunningStatus
  messageId?: string
  conversationId?: string
  createdAt?: number
  finishedAt?: number
  elapsedTime?: number
  totalTokens?: number
  error?: string
  resultText: string
  resultTabActive: boolean
  outputs?: Record<string, unknown>
  files?: FileResponse[]
  humanInputForms: HumanInputFormData[]
  humanInputFilledForms: HumanInputFilledFormData[]
}
```

### 16.3 监听态

```ts
export type ListeningState = {
  enabled: boolean
  triggerType: TriggerNodeType | null
  primaryNodeId: string | null
  nodeIds: string[]
  isAll: boolean
}
```

### 16.4 节点 runtime overlay

```ts
export type RuntimeNodeOverlay = Record<string, {
  runningStatus?: NodeRunningStatus
  singleRunningStatus?: NodeRunningStatus
  waitingRun?: boolean
  runningBranchId?: string
  iterationLength?: number
  iterationIndex?: number
  loopLength?: number
  loopIndex?: number
  retryIndex?: number
  dimmed?: boolean
  paused?: boolean
}>
```

### 16.5 边 runtime overlay

```ts
export type RuntimeEdgeOverlay = Record<string, {
  sourceRunningStatus?: NodeRunningStatus
  targetRunningStatus?: NodeRunningStatus
  waitingRun?: boolean
}>
```

### 16.6 tracing 结构

```ts
export type WorkflowTraceBucket = {
  flat: NodeTracing[]
  iterationMap: Map<string, Map<string, NodeTracing[]>>
  loopMap: Map<string, Map<string, NodeTracing[]>>
  parallelMap: Map<string, Map<string, NodeTracing[]>>
}
```

如果你想比 Dify 再清晰一点，可以把 `iterParallelLogMap` 再细拆成 iteration / loop / parallel 三个 map。

### 16.7 单步运行状态

```ts
export type SingleRunState = {
  activeNodeId?: string
  pending?: {
    nodeId: string
    action: 'run' | 'stop'
  }
  panelVisible: boolean
  runAfterSingleRun: boolean
  currentTab: 'settings' | 'lastRun' | 'relations'
}
```

---

## 17. 新项目建议的目录结构

```text
src/workflow/
  components/
    canvas/
    header/
    node-panel/
    debug-panel/
  store/
    runtime-slice.ts
    draft-slice.ts
    canvas-slice.ts
    single-run-slice.ts
  hooks/
    use-workflow-start-run.ts
    use-workflow-run.ts
    use-workflow-stop.ts
    use-node-data-update.ts
    use-sync-draft.ts
    use-single-run.ts
  hooks/run-events/
    use-workflow-started.ts
    use-workflow-finished.ts
    use-workflow-failed.ts
    use-workflow-paused.ts
    use-node-started.ts
    use-node-finished.ts
    use-iteration-started.ts
    use-iteration-next.ts
    use-iteration-finished.ts
    use-loop-started.ts
    use-loop-next.ts
    use-loop-finished.ts
    use-human-input-required.ts
    use-text-chunk.ts
    index.ts
  services/
    workflow-run.ts
    workflow-single-run.ts
    workflow-events.ts
  types/
    runtime.ts
    workflow.ts
```

这个结构基本就是把 Dify 的思想更显式化。

---

## 18. “测试运行”推荐规范

### 18.1 规范 1

运行入口必须分两步：

1. 准备态
2. 执行态

不要用户一点击就无脑发请求。

### 18.2 规范 2

运行前必须有工作流级校验。

### 18.3 规范 3

运行前必须同步草稿。

### 18.4 规范 4

Trigger 调试必须显式区分：

1. 等待监听中
2. 真正开始执行中

### 18.5 规范 5

运行中的 header 必须可中断。

### 18.6 规范 6

运行结果面板要支持：

1. 文本流式拼接
2. JSON 输出
3. 文件输出
4. human input 暂停态

### 18.7 规范 7

运行历史、last run、inspect vars 必须和当前运行联动刷新。

### 18.8 规范 8

运行态不能破坏编辑态，运行结束后用户仍应看到原图结构。

---

## 19. “运行此步骤”推荐规范

### 19.1 规范 1

单步运行必须有独立状态字段。

### 19.2 规范 2

单步运行入口可以有多个，但真正执行器最好只有一个。

### 19.3 规范 3

单步运行前也必须校验节点配置。

### 19.4 规范 4

单步运行要支持 start node、普通 node、iteration、loop、trigger node 的差异化调用方式。

### 19.5 规范 5

单步运行结束后必须刷新 inspect vars 和最近结果。

### 19.6 规范 6

单步运行 UI 应围绕“节点调试面板”组织，而不是只围绕画布按钮组织。

### 19.7 规范 7

如果单步运行处于 listening，按钮和面板都应表达 listening，而不是统一展示 running。

### 19.8 规范 8

停止单步运行要能终止 waiting 轮询、SSE 和延时任务。

---

## 20. 关键交互时序

### 20.1 普通测试运行时序

```text
用户点击 Run
-> Header 判断触发类型
-> useWorkflowStartRun 检查当前是否已在 running
-> 需要输入则打开 inputs panel
-> 不需要输入则 doSyncWorkflowDraft
-> useWorkflowRun.handleRun
-> 清旧节点运行态
-> 初始化 workflowRunningData
-> ssePost(runUrl, requestBody)
-> handleStream 分发事件
-> 各事件 hook 更新 tracing / nodes / edges / resultText
-> workflow_finished 或 failed 或 paused
-> 清理 listening / abort controller / 刷新历史
```

### 20.2 Trigger 测试运行时序

```text
用户选择 webhook/plugin/schedule/all
-> useWorkflowStartRun 预写 listeningTrigger 信息
-> doSyncWorkflowDraft
-> useWorkflowRun.handleRun(mode=trigger)
-> setIsListening(true)
-> runTriggerDebug()
-> post(trigger-run)
-> 若返回 waiting，则 delay 后继续 poll
-> 若返回 stream，则 handleStream()
-> 进入标准 workflow 事件处理链
-> 结束后 clearListeningState
```

### 20.3 运行此步骤时序

```text
用户点击“运行此步骤”
-> 设置 _isSingleRun = true 或 pendingSingleRun
-> 节点面板感知到单步运行意图
-> useOneStepRun.checkValidWrap()
-> 展示输入表单
-> 用户确认输入
-> handleRun(submitData)
-> 普通节点调用 singleNodeRun
-> iteration/loop 节点调用单节点 SSE
-> trigger 节点进入 waiting/listening 轮询
-> 更新 _singleRunningStatus
-> 刷新 inspect vars / last run
```

---

## 21. 运行态字段和 UI 映射建议

### 21.1 节点视觉建议

| 字段 | UI 建议 |
| --- | --- |
| `_waitingRun = true` | 节点轻高亮或虚线边框 |
| `_runningStatus = running` | 强高亮、转圈、聚焦 |
| `_runningStatus = succeeded` | 成功色 |
| `_runningStatus = failed` | 失败色 |
| `_runningStatus = paused` | 暂停色 |
| `_singleRunningStatus = running` | 节点局部调试 badge |
| `_singleRunningStatus = listening` | 节点局部 listening badge |
| `_dimmed = true` | 降低 opacity |

### 21.2 边视觉建议

| 字段 | UI 建议 |
| --- | --- |
| `_waitingRun = true` | 灰色待执行态 |
| `_targetRunningStatus = running` | 边高亮流光 |
| `_targetRunningStatus = succeeded` | 边已执行完成色 |
| `_targetRunningStatus = failed` | 边失败色 |

### 21.3 Header 按钮建议

| 条件 | 文案 |
| --- | --- |
| 普通 idle | Run |
| workflow running | Running |
| trigger listening | Listening |

---

## 22. 并行、迭代、循环应该怎么建模

### 22.1 结构层和运行层要同时有信息

结构层字段：

- `isInIteration`
- `iteration_id`
- `isInLoop`
- `loop_id`

运行层字段：

- `_iterationLength`
- `_iterationIndex`
- `_loopLength`
- `_loopIndex`

### 22.2 为什么需要结构字段

因为连线时就要知道边属于哪个容器。

边创建时会附带：

- `isInIteration`
- `iteration_id`
- `isInLoop`
- `loop_id`

这意味着运行态着色不必每次回头推结构。

### 22.3 为什么需要运行字段

因为结构字段只能告诉你“它在哪个容器里”。

运行字段才告诉你：

- 当前总共几轮。
- 现在执行到第几轮。

### 22.4 并行日志为什么要单独映射

因为并行分支日志不是线性追加就能看懂。

如果直接扔到 tracing 数组里，面板很难做这些功能：

1. 只看第 2 轮迭代。
2. 只看某个 parallel branch。
3. 对比同一轮下不同分支执行结果。

### 22.5 新项目建议

并行建议至少建到这个粒度：

```ts
type ParallelTraceMap = Map<
  string,
  Map<
    string,
    {
      branchId: string
      traces: NodeTracing[]
    }
  >
>
```

---

## 23. Human Input / Pause 的实现规范

### 23.1 区分 3 个概念

1. workflow paused
2. node paused
3. human input form cached

### 23.2 建议不要混成一个 `pausedPayload`

更好的拆法是：

```ts
type PauseState = {
  workflowStatus: WorkflowRunningStatus
  pausedNodeIds: string[]
  humanInputForms: HumanInputFormData[]
  humanInputFilledForms: HumanInputFilledFormData[]
}
```

### 23.3 恢复运行时的建议

当后端告诉你这条 workflow run 仍然存活，只是等待人类输入时：

1. 保留 tracing。
2. 保留节点 pause 状态。
3. 使用 `sseGet` 或等价接口继续订阅原运行事件。

不要新开一条 run。

---

## 24. 草稿同步规范

### 24.1 什么动作要立即 sync

建议立即 sync 的动作：

1. 用户点击“运行此步骤”之前。
2. 用户点击真正开始运行之前。
3. 某些关键配置提交后。

### 24.2 什么动作适合 debounce sync

建议 debounce 的动作：

1. 拖拽节点中。
2. 连线中。
3. 高频表单输入中。

### 24.3 为什么不能所有动作都立即 sync

1. 性能差。
2. 网络抖动时体验差。
3. 容易把中间态脏数据频繁写回后端。

### 24.4 为什么运行前一定要立即 sync

因为运行拿的是“可执行 DSL”。

执行态必须基于最终版本，而不是某个 debounce 尚未刷出的版本。

---

## 25. Stop 应该怎么实现

### 25.1 工作流级 stop

header 的 stop 对应：

- `useWorkflowRun().handleStopRun(taskId)`

建议行为：

1. abort 当前连接
2. 调后端 stop run API
3. 把 workflow status 改成 stopped
4. 清理 listening

### 25.2 单步运行 stop

单步运行 stop 不一定等于 workflow stop。

它可能只是：

1. 取消 webhook/plugin waiting 轮询
2. 中断单节点 SSE
3. 把 `_singleRunningStatus = stopped`

### 25.3 新项目建议

把 stop 也拆成两层：

- `stopWorkflowRun(taskId)`
- `stopSingleNodeDebug(nodeId)`

---

## 26. 面板层应该承担哪些职责

这里专门讲节点工作流面板。

### 26.1 不只是展示配置

节点面板通常还要承担：

1. 标题和描述编辑
2. 单步运行参数编辑
3. last run 展示
4. 日志展示
5. trigger 插件信息展示
6. 接收 `pendingSingleRun` 命令

### 26.2 为什么 `pendingSingleRun` 要在面板里消费

因为面板已经拥有：

1. 当前 node data
2. single run hook 上下文
3. tab 状态
4. pause 状态
5. run result 状态

这时发 run/stop 命令最合理。

---

## 27. 新项目的状态机建议

### 27.1 工作流级状态机

```text
idle
-> preparing
-> running
-> paused
-> running
-> succeeded | failed | stopped
```

### 27.2 Trigger 调试状态机

```text
idle
-> preparing
-> listening
-> running
-> paused | succeeded | failed | stopped
```

### 27.3 单节点调试状态机

```text
idle
-> panel-open
-> validating
-> listening 或 running
-> paused | succeeded | failed | stopped
```

### 27.4 节点可视状态推导建议

优先级建议：

1. `_singleRunningStatus`
2. `_runningStatus`
3. `_waitingRun`
4. 默认 idle

这样单步运行时不会被全量状态覆盖。

---

## 28. 如果从零实现，最小可用版本怎么做

### 28.1 第一阶段

先只做：

1. 普通 workflow run
2. `workflow_started`
3. `node_started`
4. `node_finished`
5. `workflow_finished`
6. `workflow_failed`

### 28.2 第二阶段

补：

1. 单步运行
2. inspect vars 刷新
3. trigger listening

### 28.3 第三阶段

补：

1. iteration / loop
2. parallel log map
3. human input pause / resume

### 28.4 不建议一开始就做的部分

1. 复杂日志分组 UI
2. 过度炫技的动画
3. 所有 trigger 一次性打齐

先把状态模型搭对，后续加功能才不会返工。

---

## 29. 参考伪代码

### 29.1 工作流运行引擎

```ts
async function runWorkflow(params: RunParams, options: RunOptions) {
  clearNodeRuntime()
  await syncDraft()
  initWorkflowSession(options)

  if (options.mode === 'webhook' || options.mode === 'plugin' || options.mode === 'schedule' || options.mode === 'all') {
    setListeningState(options)
    return runTriggerDebugSession(params, options)
  }

  clearListeningState()
  return startWorkflowSse(params, options)
}
```

### 29.2 Trigger debug

```ts
async function runTriggerDebugSession(params: RunParams, options: TriggerRunOptions) {
  while (true) {
    const response = await requestTriggerDebug(params, options)

    if (response.kind === 'waiting') {
      await delay(response.retryIn)
      continue
    }

    if (response.kind === 'error') {
      failWorkflow(response.message)
      clearListeningState()
      return
    }

    if (response.kind === 'stream') {
      consumeStream(response.stream)
      return
    }
  }
}
```

### 29.3 单步运行

```ts
async function runSingleNode(nodeId: string, inputs: Record<string, unknown>) {
  const node = getNode(nodeId)
  const valid = validateNode(node)
  if (!valid.ok)
    return notifyError(valid.message)

  setSingleRunStatus(nodeId, isTrigger(node) ? 'listening' : 'running')

  const result = await executeSingleNodeByType(node, inputs)

  refreshInspectVars(nodeId)
  updateSingleRunResult(nodeId, result)
}
```

### 29.4 事件处理器

```ts
function handleNodeStarted(event: NodeStartedEvent) {
  appendOrUpdateTracing(event)
  patchNode(event.nodeId, {
    runningStatus: 'running',
    waitingRun: false,
  })
  patchIncomingEdges(event.nodeId, {
    targetRunningStatus: 'running',
    waitingRun: false,
  })
  focusViewport(event.nodeId)
}
```

---

## 30. 对新项目的最终落地建议

如果你要把 Dify 这套能力抽出来做新项目，建议按下面顺序实现。

### 30.1 第一步先定状态模型

先确定：

1. 工作流状态枚举
2. 节点状态枚举
3. 监听态结构
4. tracing 结构
5. 单步运行结构

### 30.2 第二步再定 transport 协议

确认：

1. 普通运行走 SSE 还是 WebSocket
2. trigger debug 是否也有 waiting -> stream 两阶段
3. pause/resume 用什么接口续订

### 30.3 第三步再定 UI 组件边界

确保：

1. header 只负责入口和 stop
2. run engine 负责会话编排
3. event handlers 负责状态投影
4. node panel 负责单步调试

### 30.4 第四步实现草稿同步策略

这一点不要拖到最后。

工作流系统里，草稿同步策略和运行正确性是强相关的。

### 30.5 第五步补监控和调试信息

至少打印：

1. run mode
2. run url
3. task id
4. event sequence
5. stop reason

这会极大降低线上排障成本。

---

## 31. 最后用一句话总结“测试运行”和“运行此步骤”的本质差异

测试运行，是“以整条工作流为执行单元”的运行会话。

运行此步骤，是“以单个节点为调试单元”的局部运行会话。

两者应该：

- 共用一套视觉状态语言
- 共用一套 tracing / inspect / result 面板思想
- 但绝不能共用同一组节点状态字段

这正是 Dify 当前实现里最值得复用的核心经验。

---

## 32. 对照表：你在新项目里至少要有这些东西

### 32.1 必备 store 字段

1. `workflowRunningData`
2. `isListening`
3. `listeningTriggerType`
4. `listeningTriggerNodeId`
5. `listeningTriggerNodeIds`
6. `listeningTriggerIsAll`
7. `showSingleRunPanel`
8. `pendingSingleRun`
9. `iterParallelLogMap` 或等价结构

### 32.2 必备节点字段

1. `_runningStatus`
2. `_singleRunningStatus`
3. `_isSingleRun`
4. `_waitingRun`
5. `_runningBranchId`
6. `_iterationLength`
7. `_iterationIndex`
8. `_loopLength`
9. `_loopIndex`

### 32.3 必备 hooks

1. `useWorkflowStartRun`
2. `useWorkflowRun`
3. `useWorkflowRunEvent`
4. `useNodeDataUpdate`
5. `useNodesSyncDraft`
6. `useOneStepRun`

### 32.4 必备事件

1. `workflow_started`
2. `node_started`
3. `node_finished`
4. `workflow_finished`
5. `workflow_failed`
6. `workflow_paused`
7. `human_input_required`
8. `iteration_started`
9. `iteration_next`
10. `iteration_finished`
11. `loop_started`
12. `loop_next`
13. `loop_finished`

### 32.5 必备规范

1. 运行前先同步草稿。
2. 单步运行与全量运行分状态字段。
3. trigger debug 区分 listening 和 running。
4. tracing、nodes、edges 必须同步更新。
5. stop 和 pause 必须有明确语义。

---

## 33. 这份手册怎么用

如果你只是想快速做出一个新项目的 workflow 调试能力：

1. 先按第 16 节抄数据结构。
2. 再按第 17 节搭目录。
3. 再按第 18 节和第 19 节落“测试运行”和“运行此步骤”。
4. 最后按第 11 节的事件规则把状态投影到画布。

如果你已经有一套现成流程画布，只是缺运行态：

1. 先补 `workflowRunningData`。
2. 再补节点和边运行字段。
3. 再做 run engine 和 event handlers。

如果你要做的是企业级产品：

1. 优先把 pause/resume、trigger listening、parallel trace map 设计完整。
2. 然后再做更细的 UI 表现。

这份文档的核心不是复刻 Dify 的每一行代码。

而是把它已经验证过的运行态设计原则，整理成一套可以直接迁移到新项目的实现规范。