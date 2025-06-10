# If-Else 节点实现梳理

这份文档用于说明 Dify 前端里 `if-else` 节点是如何工作的，重点覆盖：

- `IfElsePanel` 如何编辑条件
- 节点本体如何渲染 `IF / ELIF / ELSE` 两类分支
- 分支 `handleId` 和边的 `sourceHandle` 如何一一对应
- `_targetBranches`、`_connectedSourceHandleIds` 这类下划线字段的用途
- `start / trigger` 这类节点如何通过统一的 handle 机制自动挂载后续节点选择器

目标是让你在别的项目里可以按同样的分层直接复现。

## 1. 入口注册

`if-else` 节点通过统一映射注册到工作流系统：

- `../components.ts`
  - `NodeComponentMap[BlockEnum.IfElse] = IfElseNode`
  - `PanelComponentMap[BlockEnum.IfElse] = IfElsePanel`

这意味着：

- 画布上的节点内容走 `node.tsx`
- 右侧配置面板走 `panel.tsx`

这是复现时最先要保留的约定。没有这层映射，节点能定义但不会被画布和面板系统消费。

## 2. 数据模型

核心类型在 `types.ts`。

### 2.1 条件模型

```ts
type Condition = {
  id: string
  varType: VarType
  variable_selector?: string[]
  comparison_operator?: ComparisonOperator
  value: string | string[] | boolean
  sub_variable_condition?: CaseItem
}

type CaseItem = {
  case_id: string
  logical_operator: 'and' | 'or'
  conditions: Condition[]
}
```

一个 `case` 对应一个分支。

- 第一个 `case` 显示为 `IF`
- 后续 `case` 显示为 `ELIF`
- `ELSE` 不在 `cases` 里，而是固定分支，`handleId = false`

### 2.2 节点模型

```ts
type IfElseNodeType = CommonNodeType & {
  cases: CaseItem[]
  isInIteration: boolean
  isInLoop: boolean
}
```

这里真正持久化的判断逻辑是 `cases`。另外还会在运行时挂一些以下划线开头的 UI 字段：

- `_targetBranches`: 分支列表，给 UI 和交互层消费
- `_connectedSourceHandleIds`: 当前节点哪些 source handle 已经连线
- `_connectedTargetHandleIds`: 当前节点哪些 target handle 已经连线

这些 `_` 字段更像前端运行时派生数据，不建议作为后端协议核心字段来设计。

## 3. 默认值和“两条分支”来源

默认值在 `default.ts`：

```ts
defaultValue: {
  _targetBranches: [
    { id: 'true', name: 'IF' },
    { id: 'false', name: 'ELSE' },
  ],
  cases: [
    {
      case_id: 'true',
      logical_operator: LogicalOperator.and,
      conditions: [],
    },
  ],
}
```

这段定义直接决定了初始形态：

- 一个可编辑的 `IF` 分支，`case_id = true`
- 一个固定存在的 `ELSE` 分支，`id = false`

也就是说，这个节点天然就是“双出口”：

- 真分支走 `true`
- 否则分支走 `false`

后续点击 `ELIF` 只是继续向 `cases` 里插入新分支，并同步重建 `_targetBranches`。

## 4. Panel 是怎么实现的

`panel.tsx` 本身非常薄，它只负责组装 UI，不直接写业务逻辑。

### 4.1 Panel 的职责

`panel.tsx` 做了三件事：

1. 调 `useConfig(id, data)` 取状态和操作函数
2. 把 `cases` 交给 `ConditionWrap` 渲染
3. 渲染一个 `ELIF` 按钮和一个固定的 `ELSE` 说明区

所以真正的编辑逻辑不在 panel，而在 `use-config.ts`。

### 4.2 useConfig 的职责

`use-config.ts` 是这个节点的核心状态层，负责：

- 通过 `useNodeCrud` 读写当前节点的 `inputs`
- 通过 `useAvailableVarList` 提供可选变量
- 新增、删除、排序 `case`
- 新增、删除、更新条件
- 切换 `and / or`
- 维护文件变量、子变量条件等细节

最关键的是它会同步维护 `cases` 和 `_targetBranches` 的一致性。

### 4.3 新增 ELIF

`handleAddCase` 的逻辑是：

1. 生成一个新的 `case_id`
2. 往 `draft.cases` 里追加一个空分支
3. 找到 `_targetBranches` 里 `false` 的位置
4. 把新分支插到 `ELSE` 前面
5. 调 `branchNameCorrect` 重新命名

因此分支顺序始终是：

```txt
IF -> ELIF -> ELIF -> ... -> ELSE
```

### 4.4 删除分支

`handleRemoveCase` 会同时做两件事：

- 从 `cases` 删除对应 `case_id`
- 从 `_targetBranches` 删除对应 branch

另外还会调用 `handleEdgeDeleteByDeleteBranch(id, caseId)`，把这个分支对应的边一起删掉。否则画布上会出现悬空 edge。

### 4.5 排序分支

`handleSortCase` 在拖拽排序后会：

- 重建 `cases`
- 按新的 case 顺序重建 `_targetBranches`
- 最后固定把 `{ id: 'false' }` 追加到最后
- 调 `updateNodeInternals(id)` 通知 React Flow 刷新 handle 布局

这一点很关键。分支顺序改变后，如果不调用 `updateNodeInternals`，handle 的位置和 edge 可能不同步。

## 5. 条件编辑 UI 如何分层

面板子组件大致分三层：

- `components/condition-wrap.tsx`
  - 负责 case 容器、拖拽、删除、添加条件入口
- `components/condition-add.tsx`
  - 负责选择变量，选中后创建一条 condition
- `components/condition-list/index.tsx`
  - 负责把一个 case 下的 conditions 逐条渲染，并处理 `AND / OR`

实际结构可以理解为：

```txt
Panel
  -> ConditionWrap
    -> ConditionAdd
    -> ConditionList
      -> ConditionItem
```

如果你要在别的项目复现，建议也保留这类“panel 只装配、hook 管状态、组件树分层渲染”的结构，不要把所有逻辑都塞进一个面板组件。

## 6. Node 本体如何渲染两个分支

节点画布内容在 `node.tsx`。

### 6.1 IF / ELIF 分支

`cases.map(...)` 时，每个 case 都会渲染一个 `NodeSourceHandle`：

```tsx
<NodeSourceHandle handleId={caseItem.case_id} />
```

这意味着：

- `case_id` 就是这个分支出口的唯一标识
- 从这个分支拉出去的边，`sourceHandle` 必须等于这个 `case_id`

### 6.2 ELSE 分支

`ELSE` 不是 `cases` 的一部分，而是节点底部固定渲染的一个 handle：

```tsx
<NodeSourceHandle handleId="false" />
```

所以 `ELSE` 分支的边永远满足：

```txt
edge.sourceHandle === 'false'
```

### 6.3 为什么默认 `IF` 是 `true`

默认第一个 `case_id = 'true'`，所以第一条判断分支通常是：

```txt
edge.sourceHandle === 'true'
```

随着新增 `ELIF`，后面的分支 handle 变成 uuid，而不是继续叫 `true`、`false`。

因此更准确的说法是：

- 初始 IF 分支 id 是 `true`
- ELSE 分支 id 固定是 `false`
- 后续 ELIF 分支 id 是动态生成的 uuid

## 7. handle、edge、branch 三者如何对应

这是复现时最容易漏的一层。

### 7.1 对应关系

同一条分支在三个地方必须保持一致：

1. `cases[].case_id`
2. `NodeSourceHandle.handleId`
3. `edge.sourceHandle`

对于 `ELSE`：

1. `_targetBranches` 里有 `{ id: 'false' }`
2. 节点底部渲染 `<NodeSourceHandle handleId="false" />`
3. 对应分支 edge 的 `sourceHandle` 必须是 `false`

如果这三者不一致，就会出现：

- 某个分支已经有边，但 UI 认为没连上
- Next Step 面板分支错位
- 自动布局顺序不对

## 8. `_targetBranches` 这类下划线字段到底在干什么

`CommonNodeType` 里定义了很多 `_` 前缀字段。这些字段本质上是“前端运行态附加信息”。

对 `if-else` 最重要的是下面三个。

### 8.1 `_targetBranches`

它是“这个节点有哪些出口分支”的统一描述。

对 `if-else` 来说，来源有两处：

- 初始化时在 `workflow-init.ts` 里根据 `cases + false` 生成
- 运行中在 `use-config.ts` 里随增删改排序同步更新

它主要被 `nodes/_base/components/next-step/index.tsx` 消费，用于展示每个分支的后续节点。

### 8.2 `_connectedSourceHandleIds`

`workflow-init.ts` 会根据已有 edges 计算：

```ts
node.data._connectedSourceHandleIds = connectedEdges
  .filter(edge => edge.source === node.id)
  .map(edge => edge.sourceHandle || 'source')
```

`NodeSourceHandle` 再用这个数组判断某个 handle 是否已经连接：

- 已连接时显示连线态
- 未连接时允许弹出 block selector 快速加下一个节点

### 8.3 `_connectedTargetHandleIds`

同理，这是 target 侧的连接态缓存，给 `NodeTargetHandle` 使用。

### 8.4 结论

所以 `_` 前缀字段不是“业务输入”，而是“让画布、handle、边、侧栏协同工作”的运行时桥接层。

如果你在别的项目复现，建议也这么做：

- 持久化字段保持干净
- 运行态派生字段单独挂在节点对象上

## 9. 初始化阶段如何把旧数据挂载完整

`workflow-init.ts` 对 `if-else` 做了两件关键工作。

### 9.1 兼容旧结构

如果旧节点还是：

```ts
{
  logical_operator,
  conditions,
}
```

而没有 `cases`，初始化时会自动迁移成：

```ts
cases = [{
  case_id: 'true',
  logical_operator,
  conditions,
}]
```

### 9.2 统一补齐 `_targetBranches`

初始化后会始终重建：

```ts
_targetBranches = branchNameCorrect([
  ...cases.map(item => ({ id: item.case_id, name: '' })),
  { id: 'false', name: '' },
])
```

也就是说，只要节点进到前端画布层，不管后端返回的数据多旧，最终都会变成统一的 branch 结构。

## 10. 自动布局为什么要特殊处理 If-Else

普通节点通常只有一个 `source` handle，但 `if-else` 有多个 source handle，所以 ELK 布局里单独处理了它。

`utils/elk-layout.ts` 的 `buildIfElseWithPorts` 会：

1. 找出当前 `if-else` 节点所有出边
2. 按 `cases` 顺序排序
3. 强制把 `false` 也就是 `ELSE` 放最后
4. 给每条出边生成一个独立 port

排序规则的意义是：

- 画布上的分支顺序和 panel 一致
- `ELSE` 始终稳定地在最后

如果你只画多个 handle 而不处理布局，分支线在复杂流程里会更容易交叉。

## 11. Start / Trigger 是怎么通过同一套 handle 机制挂载的

你提到的“下划线挂载 start”等，和 `if-else` 属于同一套 node handle 体系。

统一入口在 `nodes/_base/components/node-handle.tsx`。

### 11.1 `NodeSourceHandle` 是统一出口

所有节点只要要往后连节点，基本都会渲染 `NodeSourceHandle`。它内部会：

- 根据 `data._connectedSourceHandleIds` 判断连接态
- 点击 handle 时打开 `BlockSelector`
- 选择 block 后调用 `handleNodeAdd`
- 把 `prevNodeId` 和 `prevNodeSourceHandle` 传出去

所以 `if-else` 的多分支，其实只是把这个统一组件渲染多次，并传入不同的 `handleId`。

### 11.2 Start / Trigger 的特殊自动打开逻辑

`NodeSourceHandle` 里有一段 `useEffect`：

- 当 store 里的 `shouldAutoOpenStartNodeSelector = true`
- 且当前节点类型是 `Start / TriggerSchedule / TriggerWebhook / TriggerPlugin`
- 就会自动 `setOpen(true)`

这就是“新建开始节点后，自动弹出下一个节点选择器”的来源。

换句话说：

- `start` 并没有单独一套挂载系统
- 它只是复用了统一的 `NodeSourceHandle`
- 只是多了一层“自动打开 selector”的启动态逻辑

## 12. Next Step 面板为什么能按分支显示后续节点

`nodes/_base/components/next-step/index.tsx` 会读取：

- `data._targetBranches`
- 当前节点所有出边 `connectedEdges`

然后按 `branch.id === edge.sourceHandle` 把下一跳节点分组。

所以只要下面两件事成立：

- `_targetBranches` 正确
- `edge.sourceHandle` 正确

右侧 Next Step 区域就能自动分成：

- IF / CASE 1
- ELIF / CASE 2
- ELSE

## 13. 在其他项目复现的最小实现方案

如果你不打算完整照搬 Dify，可以保留下面这套最小骨架。

### 13.1 节点数据

```ts
type Branch = { id: string; name: string }

type Condition = {
  id: string
  variableSelector?: string[]
  operator?: string
  value: unknown
}

type CaseItem = {
  case_id: string
  logical_operator: 'and' | 'or'
  conditions: Condition[]
}

type IfElseNodeData = {
  cases: CaseItem[]
  _targetBranches: Branch[]
  _connectedSourceHandleIds?: string[]
}
```

### 13.2 默认值

```ts
{
  cases: [{ case_id: 'true', logical_operator: 'and', conditions: [] }],
  _targetBranches: [
    { id: 'true', name: 'IF' },
    { id: 'false', name: 'ELSE' },
  ],
}
```

### 13.3 画布节点

```tsx
cases.map(caseItem => (
  <NodeSourceHandle handleId={caseItem.case_id} />
))

<NodeSourceHandle handleId="false" />
```

### 13.4 新增分支

```ts
const newCaseId = uuid()
cases.push({ case_id: newCaseId, logical_operator: 'and', conditions: [] })
_targetBranches = rebuildBranches(cases)
```

### 13.5 删除分支

```ts
cases = cases.filter(item => item.case_id !== caseId)
_targetBranches = rebuildBranches(cases)
deleteEdgesBySourceHandle(caseId)
```

### 13.6 统一规则

- 分支显示顺序以 `cases` 为准
- `ELSE` 永远固定为 `false`
- `edge.sourceHandle` 必须与分支 id 完全一致
- 排序后记得刷新 React Flow node internals

## 14. 最值得保留的设计点

如果你只想提炼设计思想，不想逐文件照搬，建议至少保留这四点：

1. `panel` 只负责拼 UI，编辑逻辑集中到 `useConfig`
2. `case_id = handleId = edge.sourceHandle`，整个分支系统只认这一套 id
3. `_targetBranches` 作为运行态分支描述，不污染核心业务结构
4. 多分支节点在布局层要有单独 port 排序逻辑，尤其要把 `ELSE` 固定在最后

## 15. 一句话总结

`if-else` 在 Dify 里的本质不是“一个复杂表单”，而是：

- 用 `cases` 存判断规则
- 用 `_targetBranches` 描述出口
- 用 `NodeSourceHandle(handleId)` 把出口挂到画布
- 用 `edge.sourceHandle` 把每条边绑定到具体分支

只要你在别的项目里保住这四层映射关系，`if-else panel + 多分支节点` 就能稳定复现。