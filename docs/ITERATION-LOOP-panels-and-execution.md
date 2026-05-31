# IterationPanel 与 LoopPanel 梳理

这份文档按前面几份说明的口径，专门梳理这两个节点：

- `IterationPanel`
- `LoopPanel`

重点回答四个问题：

1. 它们在前端是怎么注册成 panel 的
2. 它们在前端是怎么“生成”的，包括默认值、内部 start node、`_children` 等运行态结构
3. panel 本身如何通过 `use-config.ts` 管状态
4. 哪些配置最终会被后端真正执行

## 1. 入口注册

在 `web/app/components/workflow/nodes/components.ts` 里，这两个 panel 都是通过 `PanelComponentMap` 注册的：

```ts
[BlockEnum.Iteration]: IterationPanel,
[BlockEnum.Loop]: LoopPanel,
```

对应的画布节点则由 `NodeComponentMap` 注册：

```ts
[BlockEnum.Iteration]: IterationNode,
[BlockEnum.Loop]: LoopNode,
```

这说明它们都遵守同一套前端节点结构：

- `panel.tsx` 负责右侧配置面板
- `node.tsx` 负责画布容器显示
- `use-config.ts` 负责状态改写
- `default.ts` 负责默认值和校验

## 2. 它们不只是普通 panel，而是容器节点 panel

这两个节点和 `knowledge-retrieval`、`if-else` 的最大区别是：

- 它们都不是普通单步节点
- 它们都带内部子图
- 它们都依赖 `start_node_id`
- 它们都会在前端挂 `_children`

所以这两个 panel 配的不是单个算子参数，而是“容器执行规则”。

## 3. 前端新建节点时，它们是怎么生成的

这一层关键代码在 `web/app/components/workflow/utils/node.ts`。

### 3.1 generateNewNode 会特殊处理 Iteration 和 Loop

普通节点新建时只返回 `newNode`。

但如果节点类型是：

- `BlockEnum.Iteration`
- `BlockEnum.Loop`

`generateNewNode()` 会额外创建内部 start node。

### 3.2 Iteration 的生成逻辑

如果是 `Iteration`：

1. 调 `getIterationStartNode(newNode.id)`
2. 自动生成一个 `IterationStart` 子节点
3. 把 `newNode.data.start_node_id` 指向这个子节点
4. 把 `newNode.data._children` 初始化成只包含这颗 start node

也就是：

```ts
start_node_id = newIterationStartNode.id
_children = [{ nodeId: newIterationStartNode.id, nodeType: BlockEnum.IterationStart }]
```

### 3.3 Loop 的生成逻辑

如果是 `Loop`：

1. 调 `getLoopStartNode(newNode.id)`
2. 自动生成一个 `LoopStart` 子节点
3. 把 `newNode.data.start_node_id` 指向这个子节点
4. 把 `newNode.data._children` 初始化成只包含这颗 start node

也就是：

```ts
start_node_id = newLoopStartNode.id
_children = [{ nodeId: newLoopStartNode.id, nodeType: BlockEnum.LoopStart }]
```

### 3.4 这一步为什么重要

这不是前端视觉糖。

它有两个作用：

1. 前端容器节点要知道自己内部子图入口是谁
2. 后端执行 `iteration` 和 `loop` 时都需要 `start_node_id`

少了这一步，panel 里的配置可以保存，但后端无法真正启动内部子图。

## 4. 初始化阶段怎么补齐这两个节点

如果工作流是从后端拉回来的旧 DSL，前端还会在 `web/app/components/workflow/utils/workflow-init.ts` 再做一次兜底。

逻辑是：

- 如果 `Iteration.start_node_id` 缺失，或者指向的不是 `CUSTOM_ITERATION_START_NODE`
  - 自动补一个新的 iteration start node
- 如果 `Loop.start_node_id` 缺失，或者指向的不是 `CUSTOM_LOOP_START_NODE`
  - 自动补一个新的 loop start node

同时还会：

- 重写节点上的 `start_node_id`
- 把新的内部 start node 和边补进图里
- 后续再根据父子关系计算 `_children`

所以这两个 panel 的很多字段并不完全来自用户手工输入，而是来自“新建节点 + 初始化兜底”共同生成。

## 5. IterationPanel 是怎么实现的

对应文件：

- `web/app/components/workflow/nodes/iteration/panel.tsx`
- `web/app/components/workflow/nodes/iteration/use-config.ts`
- `web/app/components/workflow/nodes/iteration/default.ts`

### 5.1 panel.tsx 的结构

`IterationPanel` 分成五块：

1. 输入数组 `input`
2. 输出变量 `output`
3. 并行模式 `parallelMode`
4. 错误处理 `errorResponseMethod`
5. 输出拍平 `flattenOutput`

对应的输入项分别是：

- `iterator_selector`
- `output_selector`
- `is_parallel`
- `parallel_nums`
- `error_handle_mode`
- `flatten_output`

### 5.2 输入数组是怎么选的

`panel.tsx` 里第一个 `VarReferencePicker` 是：

```ts
value={inputs.iterator_selector || []}
onChange={handleInputChange}
filterVar={filterInputVar}
```

`use-config.ts` 里的 `filterInputVar` 只允许数组相关变量：

- `array`
- `arrayString`
- `arrayBoolean`
- `arrayNumber`
- `arrayObject`
- `arrayFile`

也就是说，前端已经把“iteration 的输入必须可迭代”这条语义约束提前做掉了。

### 5.3 输出变量为什么能选 iteration 容器内部节点

Iteration 的 output 不是随便引用全图变量。

`use-config.ts` 会通过：

```ts
const iterationChildrenNodes = getIterationNodeChildren(id)
const childrenNodeVars = toNodeOutputVars(iterationChildrenNodes, ...)
```

先把 iteration 内部子节点的变量整理出来，再给 `VarReferencePicker` 用。

这意味着 `output_selector` 本质上是“从 iteration 子图里挑一个字段作为每轮输出”。

### 5.4 输出类型是怎么自动推导的

`handleOutputVarChange` 不只是保存 selector，还会根据被选变量类型自动推 `output_type`。

比如：

- `string -> arrayString`
- `number -> arrayNumber`
- `object -> arrayObject`
- `file -> arrayFile`

这说明 iteration 的输出语义是：

- 每轮产出一个 item
- 容器最终聚合成 array output

### 5.5 parallel / error_handle / flatten 三个开关

IterationPanel 和 LoopPanel 最大的 UI 差异就在这里。

Iteration 额外支持：

- `is_parallel`: 是否并行跑每一轮
- `parallel_nums`: 最大并行数
- `error_handle_mode`: 迭代子图异常怎么处理
- `flatten_output`: 如果每轮输出本身也是 list，是否扁平化

这些配置对应的不是前端表现，而是后端执行策略。

### 5.6 默认值和校验

`iteration/default.ts` 默认值里最关键的是：

```ts
{
  start_node_id: '',
  iterator_selector: [],
  output_selector: [],
  _children: [],
  is_parallel: false,
  parallel_nums: 10,
  error_handle_mode: terminated,
  flatten_output: true,
}
```

校验重点只有两个：

1. `iterator_selector` 必填
2. `output_selector` 必填

所以 iteration panel 的主要职责是把“输入数组”和“每轮输出引用”配置完整。

## 6. LoopPanel 是怎么实现的

对应文件：

- `web/app/components/workflow/nodes/loop/panel.tsx`
- `web/app/components/workflow/nodes/loop/use-config.ts`
- `web/app/components/workflow/nodes/loop/default.ts`

### 6.1 panel.tsx 的结构

`LoopPanel` 分成三块：

1. `loopVariables`
2. `breakCondition`
3. `loopMaxCount`

它没有 iteration 的输入数组和输出选择器，也没有并行开关。

### 6.2 loopVariables 的作用

Loop 不是从某个现成 array 自动驱动，而是更偏“带状态的自控制循环”。

所以 panel 里允许显式添加 `loop_variables`。

`use-config.ts` 中：

- `handleAddLoopVariable`
- `handleRemoveLoopVariable`
- `handleUpdateLoopVariable`

专门维护这个字段。

默认新增的 loop variable 是：

- 空 `label`
- `var_type = string`
- `value_type = constant`
- 空 `value`

### 6.3 breakCondition 的作用

Loop 的条件区不是分支条件，而是“提前停循环”的条件。

它和 `if-else` 在实现上相似：

- 也有 `conditions`
- 也有 `and/or`
- 也支持子变量条件

但语义完全不同：

- `if-else` 是选分支
- `loop` 是决定是否终止

### 6.4 loop_count 的作用

LoopPanel 通过 `InputNumberWithSlider` 配 `loop_count`。

前端会先把值 `Math.round()` 再写入，确保是整数。

`default.ts` 里再校验：

- 必须是整数
- 必须大于等于 1
- 不能超过 `LOOP_NODE_MAX_COUNT`

### 6.5 默认值和校验

Loop 的默认值核心是：

```ts
{
  start_node_id: '',
  break_conditions: [],
  loop_count: 10,
  _children: [],
  logical_operator: 'and',
}
```

校验重点是：

1. `loop_variables` 的 label 不能为空
2. `break_conditions` 必须完整
3. `loop_count` 必须合法

所以 LoopPanel 的职责是把“循环状态”和“终止规则”配完整。

## 7. 两个 panel 在前端建模上的核心差异

### 7.1 Iteration 是“数据驱动型容器”

它的核心问题是：

- 从哪个 array 迭代
- 每轮输出什么
- 是否并发
- 聚合输出怎么处理

所以 iteration panel 的中心字段是：

- `iterator_selector`
- `output_selector`
- `is_parallel`
- `parallel_nums`
- `flatten_output`

### 7.2 Loop 是“状态驱动型容器”

它的核心问题是：

- 循环里有哪些内部变量
- 循环什么时候停止
- 最多跑几轮

所以 loop panel 的中心字段是：

- `loop_variables`
- `break_conditions`
- `loop_count`

## 8. 它们在画布上的 node 是怎么配合 panel 的

### 8.1 IterationNode

`iteration/node.tsx` 本身不负责编辑，只负责容器显示：

- 背景点阵
- 候选态 `IterationStartNodeDumb`
- 当 `_children.length === 1` 时显示 `AddBlock`
- 节点初始化后调用 `handleNodeIterationRerender` 重算容器尺寸

这说明 iteration panel 配的是容器规则，而 node 负责把这个容器画出来。

### 8.2 LoopNode

`loop/node.tsx` 也是同样思路：

- 背景点阵
- 候选态 `LoopStartNodeDumb`
- 当 `_children.length === 1` 时显示 `AddBlock`
- 节点初始化后调用 `handleNodeLoopRerender`

这两个 node 的视觉结构其实非常像，因为它们都是子图容器。

## 9. 后端真正怎么执行 Iteration

对应文件：

- `api/dify_graph/nodes/iteration/iteration_node.py`
- `api/dify_graph/nodes/iteration/entities.py`

### 9.1 Iteration 是后端容器节点

后端 `IterationNode` 的定义是：

```python
execution_type = NodeExecutionType.CONTAINER
```

也就是说，前端 `IterationPanel` 里配的不是表单参数，而是后端容器执行策略。

### 9.2 后端真正依赖的字段

后端会使用：

- `start_node_id`
- `iterator_selector`
- `output_selector`
- `is_parallel`
- `parallel_nums`
- `error_handle_mode`
- `flatten_output`

其中最关键的两步是：

1. 从 `iterator_selector` 对应的 variable pool 里取 array
2. 从 `start_node_id` 启动 iteration 子图

### 9.3 后端怎么跑每一轮

如果不是并行：

- 顺序遍历 array
- 每轮创建一个内部 graph engine
- 执行 iteration 子图
- 从子图里提取 `output_selector` 对应的结果

如果是并行：

- 用 `ThreadPoolExecutor`
- 最大并发数由 `parallel_nums` 决定
- 每轮结果仍然按原 index 放回 outputs

### 9.4 flatten_output 真正在后端生效

`flatten_output` 不是前端展示开关。

后端在 `_flatten_outputs_if_needed()` 里真的会决定：

- 保持嵌套 list
- 或者把 list-of-lists 拍平成一个 list

### 9.5 error_handle_mode 也是真正的执行策略

并行模式下如果某一轮出错，后端会按：

- `TERMINATED`
- `CONTINUE_ON_ERROR`
- `REMOVE_ABNORMAL_OUTPUT`

做不同处理。

所以前端面板里那组错误处理选项，最终是后端容器行为，不是 UI 注释。

## 10. 后端真正怎么执行 Loop

对应文件：

- `api/dify_graph/nodes/loop/loop_node.py`
- `api/dify_graph/nodes/loop/entities.py`
- `api/dify_graph/nodes/loop/loop_start_node.py`
- `api/dify_graph/nodes/loop/loop_end_node.py`

### 10.1 Loop 也是后端容器节点

Loop 和 iteration 一样，也是：

```python
execution_type = NodeExecutionType.CONTAINER
```

但执行语义不同。

### 10.2 后端真正依赖的字段

Loop 后端会使用：

- `start_node_id`
- `loop_count`
- `break_conditions`
- `logical_operator`
- `loop_variables`

### 10.3 Loop 的驱动方式和 iteration 不同

Iteration 是“对一个 array 逐项执行”。

Loop 是“最多跑 N 轮，每轮跑同一个子图，并用 loop variable 和 break condition 控制是否继续”。

也就是说：

- iteration 的轮数来自输入 array 长度
- loop 的轮数来自 `loop_count` 和 break logic

### 10.4 loop_variables 在后端会真正写入变量池

`LoopNode._run()` 会把每个 loop variable 处理后写到 variable pool：

```txt
[loop_node_id, loop_variable.label]
```

所以 LoopPanel 里声明的 loopVariables 不是仅供前端显示，而是后端运行态变量。

### 10.5 break_conditions 在后端会真正求值

Loop 后端使用 `ConditionProcessor` 计算 `break_conditions`。

判断时机有两个：

1. 循环开始前先判断一次
2. 每轮结束后再判断一次

成立就提前结束 loop。

### 10.6 LoopEnd 也是真正的停止点

Loop 内部子图如果执行到了 `LoopEnd`，后端也会把它视作结束当前循环的重要信号。

所以 Loop 的停止不只依赖 break condition，也依赖 loop 子图内部结构。

## 11. 一个统一对照表

| 维度 | IterationPanel | LoopPanel |
| --- | --- | --- |
| 前端节点类型 | 容器节点 | 容器节点 |
| 新建时是否自动补 start node | 是，补 `IterationStart` | 是，补 `LoopStart` |
| 新建时是否自动补 `_children` | 是 | 是 |
| panel 主要关注点 | 输入数组、输出选择、并发、错误策略、拍平输出 | 循环变量、停止条件、最大轮数 |
| 轮数来源 | 输入 array 长度 | `loop_count` 与 break logic |
| 后端核心字段 | `iterator_selector`、`output_selector`、`is_parallel` | `loop_variables`、`break_conditions`、`loop_count` |
| 后端执行方式 | 每个元素驱动一轮子图 | 同一子图重复执行多轮 |
| 是否支持并行 | 是 | 当前这版没有并行配置 |
| 输出聚合方式 | 聚合每轮输出，可选 flatten | 依赖 loop 变量和子图输出累积 |

## 12. 生成链路总结

如果把“panel 是怎么生成的”讲完整，这两个节点的链路应该这样看：

### 12.1 Iteration

1. `components.ts` 注册 `IterationPanel`
2. `generateNewNode()` 新建 Iteration 时自动生成 `IterationStart`
3. `workflow-init.ts` 在加载旧图时兜底补 `start_node_id` 和 `_children`
4. `iteration/panel.tsx` 渲染配置表单
5. `iteration/use-config.ts` 改写节点 inputs
6. 后端 `IterationNode` 根据这些字段真正驱动子图执行

### 12.2 Loop

1. `components.ts` 注册 `LoopPanel`
2. `generateNewNode()` 新建 Loop 时自动生成 `LoopStart`
3. `workflow-init.ts` 在加载旧图时兜底补 `start_node_id` 和 `_children`
4. `loop/panel.tsx` 渲染配置表单
5. `loop/use-config.ts` 改写节点 inputs
6. 后端 `LoopNode` 根据这些字段真正控制循环执行

## 13. 一句话总结

`IterationPanel` 和 `LoopPanel` 的“生成”不是单指 React 组件渲染，而是三层一起完成的：

- `components.ts` 把它们注册成 panel
- 前端 `generateNewNode + workflow-init` 把容器运行态结构补齐
- 后端 `IterationNode / LoopNode` 把 panel 配出来的字段真正执行起来

所以更准确地说：

- 前端负责生成可执行的容器 DSL
- 后端负责让这个容器 DSL 真正跑起来

## 14. 当前仓库实现补充

这个仓库里的 `IterationPanel` / `LoopPanel` 目前已经补上了两类关键能力：

1. 前端 panel 不再是占位组件，而是会真实写入 `start_node_id`、`iterator_selector`、`output_selector`、`loop_variables`、`break_conditions`、`loop_count` 等 DSL 字段。
2. 画布节点会自动补运行态 `_children` 摘要，并在节点卡片上展示 iteration / loop 的核心配置概览。
3. 容器节点现在会真实生成内部 `IterationStart` / `LoopStart` 子节点，并支持在容器内部继续追加普通 workflow 子节点做轻量级子图编辑。

同时也要明确一个边界：

- 当前已经有轻量版容器子图编辑能力，但还没有 Dify 那种完整的容器编排系统。
- 所以这里优先保证的是“后端真正依赖的 DSL 字段完整可持久化 + 前端能看到并编辑 start/child nodes”，而不是一次性复刻完整的内部运行时画布能力。

换句话说，当前实现已经能把容器配置正确保存下来、在画布上生成内部 start 节点并追加子节点、并让前后端工程正常构建运行；如果后续要继续逼近文档里的完整形态，下一步应该补的是更完整的容器内部布局、LoopEnd/IterationEnd 一类专用节点以及更细的子图运行态可视化。