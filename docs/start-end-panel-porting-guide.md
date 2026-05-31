# StartPanel / EndPanel 抽离与迁移指南

本文基于以下实现分析：

- `web/app/components/workflow/nodes/start/panel.tsx`
- `web/app/components/workflow/nodes/start/use-config.ts`
- `web/app/components/workflow/nodes/start/components/var-list.tsx`
- `web/app/components/workflow/nodes/start/components/var-item.tsx`
- `web/app/components/workflow/nodes/end/panel.tsx`
- `web/app/components/workflow/nodes/end/use-config.ts`
- `web/app/components/workflow/nodes/_base/hooks/use-var-list.ts`
- `web/app/components/workflow/nodes/_base/components/variable/var-list.tsx`

目标不是“照搬 Dify 组件”，而是把它们拆成你在另一个项目里可独立落地的逻辑层、状态层和 UI 层。

---

## 1. 两个 Panel 分别在做什么

### StartPanel

StartPanel 本质上是“工作流入口变量管理器”，负责：

- 展示和编辑开始节点的输入变量 `variables: InputVar[]`
- 新增变量
- 编辑变量名、标签、类型、必填等元信息
- 删除变量
- 拖拽排序变量
- 在聊天模式下展示两个内置只读变量：
  - `userinput.query`
  - `userinput.files`
- 当变量被其他节点引用时：
  - 改名要级联同步引用
  - 删除要先二次确认，再清理下游引用
- 维护 inspector/调试变量的同步状态

### EndPanel

EndPanel 本质上是“工作流输出映射编辑器”，负责：

- 展示和编辑结束节点的输出变量 `outputs: Variable[]`
- 新增输出项
- 编辑输出名 `variable`
- 为输出项选择值来源 `value_selector`
- 删除输出项
- 拖拽排序输出项

它没有 StartPanel 那种“变量被全局引用后的级联治理”复杂度，所以明显更适合作为基础通用组件抽离。

---

## 2. 两者的复杂度差异

### StartPanel 的复杂点

- 不只是列表编辑，而是“工作流变量生命周期管理”
- 变量名变更会影响其他节点上的变量引用
- 删除变量前需要检查下游节点是否仍在使用
- 删除变量后需要清理依赖节点中的失效引用
- 还带有调试态 inspector 变量同步逻辑
- 聊天模式下存在系统保留变量，属于只读展示项，不允许用户编辑

### EndPanel 的复杂点

- 主要是普通表单列表编辑
- 一项输出由两部分组成：
  - 输出变量名
  - 输出值来源
- 值来源既可以是变量引用，也可能支持常量模式（当前基础组件已预留）
- 依赖变量选择器组件，但业务联动相对少

结论：

- EndPanel 可以直接抽成“通用输出映射编辑器”
- StartPanel 不建议整块搬。应拆成“变量列表 UI” + “工作流依赖治理服务”

---

## 3. Dify 代码里的真实依赖边界

### StartPanel 直接依赖

- `useNodesReadOnly()`
- `useIsChatMode()`
- `useWorkflow()`
- `useNodeCrud()`
- `useInspectVarsCrud()`
- `ConfigVarModal`
- `RemoveEffectVarConfirm`
- `Toast`
- `hasDuplicateStr()`
- `immer/produce`
- `ReactSortable`

其中真正和“迁移项目”强绑定的是下面这些：

- `useWorkflow()`
  - `handleOutVarRenameChange`
  - `isVarUsedInNodes`
  - `removeUsedVarInNodes`
- `useInspectVarsCrud()`
  - inspector 调试变量同步
- `useNodeCrud()`
  - 节点数据回写到工作流 store

### EndPanel 直接依赖

- `useNodesReadOnly()`
- `useNodeCrud()`
- `useVarList()`
- 基础版 `VarList`

EndPanel 的 Dify 依赖非常浅。真正要换掉的通常只有：

- 节点数据存取方式
- 变量选择器组件
- 提示组件

---

## 4. 迁移时应该怎么拆层

推荐拆成 3 层。

### 第一层：纯类型层

先把 Dify 类型最小化，不要把整套工作流类型系统一起搬过去。

```ts
export type ValueSelector = string[]

export type InputVarType =
  | 'text-input'
  | 'paragraph'
  | 'select'
  | 'number'
  | 'url'
  | 'files'
  | 'json'
  | 'json_object'
  | 'file'
  | 'file-list'
  | 'checkbox'

export type InputVar = {
  type: InputVarType
  variable: string
  label?: string
  required?: boolean
  default?: string | number
  options?: string[]
  placeholder?: string
  hint?: string
  value_selector?: ValueSelector
}

export type OutputVar = {
  variable: string
  value_selector: ValueSelector
  value_type?: string
  variable_type?: 'variable' | 'constant'
  value?: string
}
```

### 第二层：领域逻辑层

这一层只处理规则，不渲染 UI。

StartPanel 需要一个领域服务：

```ts
export interface WorkflowVariableDependencyService {
  renameVariableReference(params: {
    nodeId: string
    oldSelector: ValueSelector
    newSelector: ValueSelector
  }): void

  isVariableUsed(selector: ValueSelector): boolean

  removeVariableReferences(selector: ValueSelector): void
}

export interface InspectVarService {
  rename(nodeId: string, oldName: string, newName: string): void
  remove(nodeId: string, variableId: string): void
  removeAll(nodeId: string): void
  findVarId(nodeId: string, varName: string): string | undefined
}
```

EndPanel 则只需要一个轻量编辑服务：

```ts
export interface OutputMappingEditor {
  addEmpty(): void
  updateAll(list: OutputVar[]): void
}
```

### 第三层：展示层

展示层只关心：

- 当前列表
- 只读状态
- 点击新增
- 编辑一项
- 删除一项
- 排序一项
- 打开弹窗

这样换 UI 框架也不影响规则层。

---

## 5. StartPanel 的核心逻辑拆解

### 5.1 状态模型

StartPanel 实际需要这几个状态：

- `variables`: 当前输入变量列表
- `readOnly`: 是否只读
- `isChatMode`: 是否聊天模式
- `isAddModalOpen`: 是否显示新增变量弹窗
- `isRemoveConfirmOpen`: 是否显示删除确认弹窗
- `pendingRemovedSelector`: 待删除变量的 selector
- `pendingRemovedIndex`: 待删除变量的索引

### 5.2 新增变量逻辑

新增变量不是简单 push，而是必须做唯一性校验。

校验规则：

- `variable` 不能重复
- `label` 不能重复

Dify 当前做法是在 `handleAddVariable()` 里：

1. 先把 payload 放入新列表
2. 检查 `variable` 是否重复
3. 检查 `label` 是否重复
4. 如果重复，toast 报错并返回 `false`
5. 不重复则提交到 store

可迁移实现：

```ts
export function validateStartVariables(list: InputVar[]) {
  const variableSet = new Set<string>()
  const labelSet = new Set<string>()

  for (const item of list) {
    const variable = item.variable.trim()
    const label = (item.label || '').toString().trim()

    if (variable && variableSet.has(variable)) {
      return { valid: false, reason: 'duplicate-variable' as const }
    }
    if (label && labelSet.has(label)) {
      return { valid: false, reason: 'duplicate-label' as const }
    }

    if (variable)
      variableSet.add(variable)
    if (label)
      labelSet.add(label)
  }

  return { valid: true as const }
}
```

### 5.3 编辑变量逻辑

编辑时有 3 类情况：

- 改变量名
- 改变量其他属性，比如类型、必填、默认值
- 删除变量

其中只有“改变量名”需要同步整个工作流中的引用。

同步规则：

```ts
dependencyService.renameVariableReference({
  nodeId,
  oldSelector: [nodeId, oldVariableName],
  newSelector: [nodeId, newVariableName],
})
```

如果你的新项目没有“变量引用 selector”这个设计，就把它改成你自己的引用地址模型，例如：

```ts
type VariableRef = {
  sourceNodeId: string
  sourceKey: string
}
```

### 5.4 删除变量逻辑

删除前的关键流程：

1. 找到该变量是否有 inspector 记录，有就先删掉
2. 判断该变量是否仍被其他节点使用
3. 如果被使用，弹确认框，不立刻删
4. 用户确认后：
   - 从当前变量列表删除
   - 清理下游节点引用
5. 如果未被使用，则直接删除

这个流程是 StartPanel 最不能丢的逻辑。否则你在另一个项目里会出现：

- 输入变量删掉了，但其他节点还保留旧引用
- 运行时拿到空值或脏配置
- 编辑器表现正常，但执行阶段报错

建议抽成独立动作：

```ts
export interface RemoveStartVariableResult {
  requiresConfirm: boolean
  apply: () => void
}

export function prepareRemoveStartVariable(params: {
  nodeId: string
  index: number
  current: InputVar[]
  dependencyService: WorkflowVariableDependencyService
}) : RemoveStartVariableResult {
  const target = params.current[params.index]
  const selector: ValueSelector = [params.nodeId, target.variable]

  const apply = () => {
    params.dependencyService.removeVariableReferences(selector)
  }

  return {
    requiresConfirm: params.dependencyService.isVariableUsed(selector),
    apply,
  }
}
```

注意：上面只演示“依赖清理决策”，真正删除本地数组的动作应由组件状态层一起完成。

### 5.5 系统保留变量

StartPanel 里有两个并不来自用户配置的变量：

- 聊天模式下显示 `userinput.query`
- 始终显示 `userinput.files`

这两个变量的性质是：

- 只读
- 不参与可编辑列表排序
- 不应该写回用户的 `variables` 配置
- 更适合视为“系统注入变量”

在新项目里，建议你不要把它们混到用户可编辑数组里，而是单独建：

```ts
export type SystemVar = {
  variable: string
  typeLabel: string
  visible: boolean
}

export function getStartSystemVars(isChatMode: boolean): SystemVar[] {
  return [
    { variable: 'userinput.query', typeLabel: 'String', visible: isChatMode },
    { variable: 'userinput.files', typeLabel: 'Array<File>', visible: true },
  ].filter(item => item.visible)
}
```

---

## 6. EndPanel 的核心逻辑拆解

EndPanel 明显简单很多。

### 6.1 状态模型

- `outputs`: 输出映射数组
- `readOnly`: 是否只读

### 6.2 新增输出项

Dify 当前实现就是添加一个空对象：

```ts
{
  variable: '',
  value_selector: [],
}
```

这个策略可以原样保留。

### 6.3 输出项编辑

每一行做两件事：

- 编辑目标输出变量名
- 选择值来源

值来源选择器 `VarReferencePicker` 是 Dify 里真正偏平台化的部分，因为它依赖：

- 当前节点 id
- 可用上游节点变量列表
- 是否仅显示叶子节点变量
- 是否允许文件变量
- 是否支持常量值

如果你要在另一个项目里“完美实现”，你需要抽象的其实不是 EndPanel，而是 `VarReferencePicker` 的输入协议。

推荐最小协议：

```ts
export type VariableOption = {
  label: string
  value: ValueSelector
  type?: string
}

export interface VariablePickerProps {
  value: ValueSelector | string
  readonly?: boolean
  options: VariableOption[]
  allowConstant?: boolean
  onChange: (value: ValueSelector | string, mode: 'variable' | 'constant') => void
}
```

一旦你把变量选择器标准化，EndPanel 几乎可以原样换壳。

---

## 7. 最推荐的抽离方式

不要按页面搬，要按能力搬。

### 建议抽成 4 个可复用单元

#### A. `VariableListEditor`

适用于 StartPanel。

职责：

- 渲染变量列表
- 支持编辑一项
- 支持删除一项
- 支持拖拽排序
- 支持展示系统保留变量

不负责：

- 工作流引用联动
- inspector 同步
- 节点 store 落库

#### B. `OutputMappingEditor`

适用于 EndPanel。

职责：

- 渲染输出映射
- 编辑输出变量名
- 选择输出值来源
- 增删改排

#### C. `useStartVariableModel`

职责：

- 新增变量校验
- 改名联动
- 删除前依赖检查
- 删除后引用清理
- 与宿主 store 同步

#### D. `useOutputMappingModel`

职责：

- 新增空输出项
- 更新列表
- 与宿主 store 同步

---

## 8. 可以直接复制到新项目的骨架

### 8.1 StartPanel 逻辑骨架

```ts
import { useMemo, useState } from 'react'

type UseStartVariableModelParams = {
  nodeId: string
  readOnly: boolean
  isChatMode: boolean
  variables: InputVar[]
  setVariables: (next: InputVar[]) => void
  dependencyService: WorkflowVariableDependencyService
  inspectService?: InspectVarService
  notify?: (message: string) => void
}

export function useStartVariableModel({
  nodeId,
  readOnly,
  isChatMode,
  variables,
  setVariables,
  dependencyService,
  inspectService,
  notify,
}: UseStartVariableModelParams) {
  const [isAddModalOpen, setAddModalOpen] = useState(false)
  const [removeTargetIndex, setRemoveTargetIndex] = useState<number | null>(null)

  const systemVars = useMemo(() => getStartSystemVars(isChatMode), [isChatMode])

  const addVariable = (payload: InputVar) => {
    const next = [...variables, payload]
    const result = validateStartVariables(next)
    if (!result.valid) {
      notify?.(result.reason)
      return false
    }
    setVariables(next)
    return true
  }

  const updateVariable = (index: number, payload: InputVar) => {
    const previous = variables[index]
    const next = variables.map((item, current) => current === index ? payload : item)

    const result = validateStartVariables(next)
    if (!result.valid) {
      notify?.(result.reason)
      return false
    }

    setVariables(next)

    if (previous.variable !== payload.variable) {
      dependencyService.renameVariableReference({
        nodeId,
        oldSelector: [nodeId, previous.variable],
        newSelector: [nodeId, payload.variable],
      })
      inspectService?.rename(nodeId, previous.variable, payload.variable)
    }
    else {
      inspectService?.removeAll(nodeId)
    }

    return true
  }

  const requestRemoveVariable = (index: number) => {
    const target = variables[index]
    const selector: ValueSelector = [nodeId, target.variable]

    const inspectId = inspectService?.findVarId(nodeId, target.variable)
    if (inspectId)
      inspectService?.remove(nodeId, inspectId)

    if (dependencyService.isVariableUsed(selector)) {
      setRemoveTargetIndex(index)
      return { needsConfirm: true }
    }

    const next = variables.filter((_, current) => current !== index)
    setVariables(next)
    return { needsConfirm: false }
  }

  const confirmRemoveVariable = () => {
    if (removeTargetIndex === null)
      return

    const target = variables[removeTargetIndex]
    const selector: ValueSelector = [nodeId, target.variable]
    const next = variables.filter((_, current) => current !== removeTargetIndex)

    setVariables(next)
    dependencyService.removeVariableReferences(selector)
    setRemoveTargetIndex(null)
  }

  return {
    readOnly,
    variables,
    systemVars,
    isAddModalOpen,
    setAddModalOpen,
    removeTargetIndex,
    addVariable,
    updateVariable,
    setVariables,
    requestRemoveVariable,
    confirmRemoveVariable,
    cancelRemoveVariable: () => setRemoveTargetIndex(null),
  }
}
```

### 8.2 EndPanel 逻辑骨架

```ts
type UseOutputMappingModelParams = {
  outputs: OutputVar[]
  setOutputs: (next: OutputVar[]) => void
}

export function useOutputMappingModel({
  outputs,
  setOutputs,
}: UseOutputMappingModelParams) {
  const addOutput = () => {
    setOutputs([
      ...outputs,
      {
        variable: '',
        value_selector: [],
      },
    ])
  }

  const updateOutput = (index: number, patch: Partial<OutputVar>) => {
    setOutputs(outputs.map((item, current) => {
      if (current !== index)
        return item
      return { ...item, ...patch }
    }))
  }

  const removeOutput = (index: number) => {
    setOutputs(outputs.filter((_, current) => current !== index))
  }

  const reorderOutputs = (next: OutputVar[]) => {
    setOutputs(next)
  }

  return {
    outputs,
    addOutput,
    updateOutput,
    removeOutput,
    reorderOutputs,
  }
}
```

---

## 9. 在另一个项目里“完美实现”必须补的宿主能力

如果你只是复制 JSX，效果会像，但行为不会完整。真正必须补齐的是这几项。

### StartPanel 必须补齐

1. 节点数据持久化接口

```ts
type NodeDataStore = {
  updateNodeData: (nodeId: string, patch: unknown) => void
}
```

2. 变量依赖分析接口

```ts
type WorkflowGraphInspector = {
  isVariableUsed: (selector: ValueSelector) => boolean
  renameVariableReference: (params: {
    nodeId: string
    oldSelector: ValueSelector
    newSelector: ValueSelector
  }) => void
  removeVariableReferences: (selector: ValueSelector) => void
}
```

3. 保留变量策略

- 你的系统里是否也有系统注入变量
- 这些变量是否显示给用户
- 是否允许覆盖命名

4. 变量命名规则

- 是否允许空格
- 是否允许中文
- 是否区分大小写
- 是否限制首字符

### EndPanel 必须补齐

1. 上游变量选择器
2. 输出变量名校验规则
3. 常量模式是否开启
4. 文件变量是否可选

---

## 10. 迁移优先级建议

### 如果你时间有限

优先级顺序建议如下：

1. 先迁移 EndPanel
2. 再迁移 StartPanel 的 UI 和新增/编辑逻辑
3. 最后补 StartPanel 的“改名联动 + 删除清理”

原因很直接：

- EndPanel 是低耦合组件，最快能复用
- StartPanel 的难点不在 UI，而在“变量引用治理”

---

## 11. 哪些代码可以直接抄，哪些不能

### 可以直接借鉴的

- StartPanel 的变量唯一性校验思路
- StartPanel 的系统保留变量展示思路
- EndPanel 的空输出项初始化策略
- 两类列表的拖拽排序交互
- “展示层 + hook 层”的分离方式

### 不要原样搬的

- `useWorkflow()` 整体
- `useInspectVarsCrud()` 整体
- Dify 的 i18n、Toast、Modal 组件
- Dify 的 `VarReferencePicker`
- Dify 的 `useNodeCrud()`

这些都太依赖 Dify 宿主环境。应该保留接口形状，重写实现。

---

## 12. 最终落地建议

如果你的目标是在另一个项目里稳定复用，我建议按下面的目录组织：

```txt
workflow-panels/
  types.ts
  services/
    dependency-service.ts
    inspect-service.ts
  start/
    use-start-variable-model.ts
    start-variable-list.tsx
    start-system-vars.ts
    validators.ts
  end/
    use-output-mapping-model.ts
    output-mapping-editor.tsx
  shared/
    sortable-list.tsx
    variable-picker.tsx
    confirm-dialog.tsx
    notification.ts
```

这样迁移后的代码具备几个优点：

- UI 可替换
- 工作流引擎可替换
- 状态管理可替换
- StartPanel 和 EndPanel 可以独立演进

---

## 13. 一句话结论

这两个 panel 里，真正值得复用的是：

- EndPanel 的“输出映射编辑模型”
- StartPanel 的“入口变量生命周期治理模型”

真正不该照搬的是：

- Dify 的宿主 store、工作流 hook、变量选择器和调试耦合实现

换句话说，你应该复制的是“接口和规则”，不是“项目内耦合实现”。
