# LLMPanel 复刻说明

本文档用于梳理当前 Dify LLMPanel 的功能、状态存储方式、关联组件以及在另一个项目中复刻相近界面和行为时的实现方案。目标不是解释单个文件，而是让另一个项目中的实现者或大模型，读完后可以较高保真地复现出当前面板的结构、数据模型和交互逻辑。

## 1. 目标与定位

LLMPanel 是工作流编辑器中 LLM 节点的配置面板，负责编辑一个 LLM 节点的全部输入配置。它的职责不是执行模型调用，而是让用户完成以下配置：

1. 选择模型与模型参数。
2. 选择知识检索上下文变量。
3. 编辑 Prompt。
5. 配置 Memory。
6. 配置视觉输入和分辨率（通过后端压缩实现中低高分辨率）。
7. 配置推理结果格式。
8. 配置结构化输出 Schema。
9. 展示节点输出变量定义。

当前实现的入口文件是：

- `panel.tsx`: 面板 UI 组装。
- `use-config.ts`: 业务状态与所有事件处理。
- `default.ts`: 节点默认值与校验逻辑。
- `types.ts`: 节点数据结构定义。
- `node.tsx`: 节点卡片上的简化展示。

## 2. 整体 UI 分区

LLMPanel 的 UI 可以理解为两个大区域。

### 2.1 上半区：输入配置

上半区按顺序包含：

1. Model
2. Context
3. Prompt
5. Memory 内置 user query editor（条件显示）
6. Memory 配置（条件显示）
7. Vision 配置
8. Reasoning Format

### 2.2 下半区：输出配置

下半区通过 `OutputVars` 包裹，默认展示固定输出变量：

1. `text`
2. `reasoning_content`
3. `usage`

当 `structured_output_enabled = true` 时，在输出变量列表下追加 `structured_output` 的 Schema 配置区。

## 3. 组件结构与职责分工

### 3.1 Panel 本身只做组装

`panel.tsx` 基本不保存业务状态，它只负责：

1. 调用 `useConfig(id, data)` 拿到所有状态和 handler。
2. 根据状态决定哪些区块显示。
3. 将 handler 透传给各个子组件。
4. 在少量地方补充 UI 级别逻辑，例如模型切换后先过滤 completion params，再真正切换模型。

所以如果要在另一个项目复刻，建议保留这种模式：

- 面板组件负责布局和条件渲染。
- 单独的 hook 或 presenter 负责状态推导与写入。

### 3.2 关键子组件

以下组件是当前 LLMPanel 的主要组成部分。

#### A. `ModelParameterModal`

职责：

1. 选择模型 provider 与 model。
2. 编辑 completion params。
3. 返回新的模型配置。

面板侧额外做了一层包装：

1. 在真正调用 `handleModelChanged` 前，先执行 `fetchAndMergeValidCompletionParams`。
2. 如果旧的 completion params 中有参数对新模型不合法，则自动移除并弹 warning toast。
3. 如果拉取失败，则弹 error toast，并将 completion params 清空为 `{}`。

这个逻辑很重要。复刻时不要只做“换模型”，还要做“迁移旧参数并清洗不兼容项”。

#### B. `VarReferencePicker`

职责：

1. 给 `context.variable_selector` 选变量。
2. 给 `vision.configs.variable_selector` 选文件变量。

它依赖可用变量树，因此它不是一个简单的 select，而是一个能浏览前置节点输出变量的选择器。

#### C. `ConfigPrompt`

职责：

1. 根据 `isChatModel` 在两种 Prompt 形态间切换。
2. Chat model 下维护 message list。
3. Completion model 下维护单段 prompt。
4. 支持 basic / jinja2 两种编辑模式。
5. 支持 prompt generator。
6. 把可插入变量、上下文块、查询块等能力注入编辑器。

它内部还依赖：

1. `ConfigPromptItem`
2. `Editor`
3. `ReactSortable`
4. `useAvailableVarList`

#### D. `VarList`

职责：

2. 每一项包含变量名和 value selector。
3. 允许新增、编辑变量名、改绑定来源。

#### E. `MemoryConfig`

职责：

1. 控制是否启用 memory。
2. 控制 `window.enabled` 和 `window.size`。
3. Completion model 下允许设置 `role_prefix.user` 与 `role_prefix.assistant`。

#### F. 内置 user query editor

这是 Memory 启用后的补充区域，不是 `MemoryConfig` 本身的一部分。

职责：

1. 显示一个固定标题为 `user` 的 Prompt 编辑器。
2. 编辑 `memory.query_prompt_template`。
3. 提醒用户必须包含 `{{#sys.query#}}`。

它只在以下条件下显示：

1. 工作流是 chat mode。
2. 当前模型是 chat model。
3. `inputs.memory` 存在。

#### G. `ConfigVision`

职责：

1. 展示是否启用视觉输入的开关。
2. 选择图片或文件变量。
3. 选择视觉分辨率。

注意它只有在模型支持 vision feature 时才能启用。

#### H. `ReasoningFormatConfig`

职责：

1. 切换 `reasoning_format`。
2. UI 上是一个开关。
3. `ON = separated`，`OFF = tagged`。

#### I. `OutputVars`

职责：

1. 折叠/展开输出区。
2. 展示固定输出变量。
3. 挂载结构化输出开关和附加编辑区。

#### J. `StructureOutput`

职责：

1. 编辑 `structured_output.schema`。
2. 打开 `JsonSchemaConfigModal` 配置 JSON Schema。
3. 已配置时用 `ShowPanel` 展示 schema 树。

## 4. 节点数据结构

LLM 节点持久化的数据结构可近似理解为：

```ts
type LLMNodeType = CommonNodeType & {
  model: {
    provider: string
    name: string
    mode: string
    completion_params: Record<string, any>
  }
  prompt_template: PromptItem[] | PromptItem
  prompt_config?: {
    jinja2_variables?: Array<{
      variable: string
      value_selector: string[]
    }>
  }
  memory?: {
    role_prefix?: {
      user: string
      assistant: string
    }
    window: {
      enabled: boolean
      size: number | string | null
    }
    query_prompt_template: string
  }
  context: {
    enabled: boolean
    variable_selector: string[]
  }
  vision: {
    enabled: boolean
    configs?: {
      detail: 'high' | 'low' | 'auto'
      variable_selector: string[]
    }
  }
  structured_output_enabled?: boolean
  structured_output?: {
    schema: {
      type: 'object'
      properties: Record<string, Field>
      required?: string[]
      additionalProperties: false
    }
  }
  reasoning_format?: 'tagged' | 'separated'
}
```

### 4.1 默认值

默认值主要来自 `default.ts`：

```ts
{
  model: {
    provider: '',
    name: '',
    mode: 'chat',
    completion_params: { temperature: 0.7 },
  },
  prompt_template: [{ role: 'system', text: '' }],
  context: { enabled: false, variable_selector: [] },
  vision: { enabled: false },
}
```

注意：

1. `memory` 默认并不启用。
2. `structured_output_enabled` 默认未开启。
3. `reasoning_format` 未显式写入时，UI 视为 `tagged`。

### 4.2 Prompt 的两种形态

这是最关键的分叉点。

#### Chat model

`prompt_template` 是数组：

```ts
[
  { role: 'system', text: '' },
  { role: 'user', text: '' },
  { role: 'assistant', text: '' },
]
```

#### Completion model

`prompt_template` 是单对象：

```ts
{ text: '', edition_type?: 'basic' | 'jinja2', jinja2_text?: '' }
```

复刻时必须保留这种联合类型，或者在你的实现中先统一成 view model，再在保存时转换。

## 5. 状态存储分层

当前 LLMPanel 不是把所有状态都放在 React local state，而是分成 4 层。

### 5.1 持久层：节点 data.inputs

最核心的数据保存在工作流节点的 `data` 内，也就是 `useNodeCrud(id, payload)` 的 `inputs`。

所有真正需要随节点保存的配置都写回这里，例如：

1. `model`
2. `prompt_template`
3. `prompt_config`
4. `memory`
5. `context`
6. `vision`
7. `structured_output_enabled`
8. `structured_output`
9. `reasoning_format`

### 5.2 ReactFlow 内存层：当前画布节点状态

`useNodeCrud` 内部调用 `useNodeDataUpdate`。

`useNodeDataUpdate` 会：

1. 通过 ReactFlow store 读取当前 nodes。
2. 找到目标节点。
3. 直接更新该节点的 `data`。

也就是说，用户每次改配置时，画布内存里的节点数据是立即更新的。

### 5.3 草稿同步层：workflow draft

`handleNodeDataUpdateWithSyncDraft` 在更新当前节点内存后，还会调用 `handleSyncWorkflowDraft`。

这个同步是：

1. 默认走防抖同步。
2. 也支持显式同步。
3. 如果节点处于只读模式，更新和同步都直接中断。

这意味着 LLMPanel 的编辑不是只改本地组件 state，而是直接写工作流草稿。

### 5.4 面板本地临时状态

`use-config.ts` 内部有少量 local state，只用于 UI 或衍生逻辑，不作为节点最终配置保存：

1. `defaultRolePrefix`
   - 用于 completion model 默认 prompt config 注入时记住 conversation role prefix。
2. `modelChanged`
   - 用于模型切换后触发 vision 配置修正。
3. `structuredOutputCollapsed`
   - 只影响输出区折叠态。
4. `inputRef`
   - 用于在 callback 中拿到最新 inputs，避免闭包拿旧值。

如果你在别的项目中实现，建议也保留一个“持久状态 + 临时 UI 状态”分层，而不要把所有字段都塞进本地 state 再统一提交。

## 6. `useConfig` 的核心职责

`useConfig` 是复刻时最值得保留的抽象，它做了 5 类工作。

### 6.1 将节点输入包装成可更新的配置对象

核心接口：

1. `inputs`
2. `setInputs(newInputs)`

它在 `setInputs` 中额外补了一个行为：

如果 `newInputs.memory` 存在但没有 `role_prefix`，会自动补入 `defaultRolePrefix`。

### 6.2 派生 UI 条件状态

例如：

1. `isChatMode`
2. `isChatModel`
3. `isCompletionModel`
4. `isVisionModel`
5. `isShowVars`
6. `isModelSupportStructuredOutput`
7. `shouldShowContextTip`

这些值决定面板各区块是否显示。

### 6.3 提供字段级 handler

例如：

1. `handleModelChanged`
2. `handleCompletionParamsChange`
3. `handleContextVarChange`
4. `handlePromptChange`
5. `handleAddEmptyVariable`
6. `handleAddVariable`
7. `handleVarListChange`
8. `handleVarNameChange`
9. `handleMemoryChange`
10. `handleSyeQueryChange`
11. `handleVisionResolutionEnabledChange`
12. `handleVisionResolutionChange`
13. `handleStructureOutputEnableChange`
14. `handleStructureOutputChange`
15. `handleReasoningFormatChange`

这些 handler 基本都遵循一个模式：

1. 从 `inputRef.current` 取最新数据。
2. 用 `immer.produce` 产生新对象。
3. 调用 `setInputs`。

### 6.4 处理默认 prompt 注入

当节点默认配置 `nodesDefaultConfigs[payload.type]` 准备好后，如果当前 `inputs.prompt_template` 为空，`useConfig` 会自动注入默认 prompt。

这一步不是 UI 层逻辑，而是配置初始化逻辑。

### 6.5 处理模型切换引发的连锁修改

切模型时，不只是改 `model.provider` 和 `model.name`，还会：

1. 根据新模型 mode 判断 chat / completion。
2. 如果 mode 发生变化，重置 prompt_template 为对应默认模板。
3. 触发 vision 配置修正。
4. 由面板层先清洗 completion params。

复刻时千万不要把模型切换实现成一个独立字段修改，否则 UI 很容易和 prompt 结构、vision 状态失配。

## 7. 条件渲染矩阵

这是复刻时最容易漏的部分。

### 7.1 Prompt 区显示条件

仅当 `model.name` 存在时显示 Prompt 区。

原因：

1. Prompt editor 依赖当前模型配置。
2. Prompt generator 也需要模型信息。


### 7.3 Memory 顶部内置 user query editor

显示条件：

1. 工作流是 chat mode。
2. 当前模型是 chat model。
3. `inputs.memory` 存在。

### 7.4 MemoryConfig

显示条件：

1. 工作流是 chat mode。

注意这里不是“当前模型是 chat model”，而是“应用整体是 chat mode”。

### 7.5 Vision 配置

始终渲染 `ConfigVision`，但内部由 `isVisionModel` 和 `enabled` 决定内容是否可操作、是否展开子配置。

### 7.6 结构化输出 schema 配置区

显示条件：

1. `inputs.structured_output_enabled === true`

### 7.7 上下文未插入提示

当：

1. `inputs.context.enabled === true`
2. Prompt 中未检测到 context block

则显示 warning tip。

## 8. Prompt 编辑器的复刻重点

Prompt 部分是复刻成本最高的区域。

### 8.1 Chat model 下的行为

1. `prompt_template` 是 message 数组。
2. 支持拖拽排序。
3. 第一条如果是 `system`，不允许拖拽离开首位。
4. `system` 角色最多只能有一个。
5. 新增消息时：
   - 如果列表为空，新增 `system`。
   - 如果最后一条是 `user`，下一条默认 `assistant`。
   - 否则默认 `user`。
6. 每条 message 都支持：
   - 切角色
   - 改文本
   - 切 basic / jinja2
   - 删除
   - 打开 prompt generator

### 8.2 Completion model 下的行为

1. 只有一个 Prompt editor。
2. 支持 basic / jinja2 两种编辑模式。
3. 支持 prompt generator。

### 8.3 Prompt 中的 block 检测

当前实现会计算 `hasSetBlockStatus`，主要检测：

1. 是否插入 `context` block。
2. 是否插入 `history` block。
3. 是否插入 `query` block。

这主要用于：

1. 提醒用户虽然选了 context 变量，但 prompt 里没引用 context。
2. 给编辑器提供辅助 UI。


## 9. Memory 设计细节

Memory 在当前实现里分成两块。

### 9.1 是否启用 memory

通过 `MemoryConfig` 的总开关控制。开启后会写入默认值：

```ts
{
  window: { enabled: false, size: 50 },
  query_prompt_template: '{{#sys.query#}}\n\n{{#sys.files#}}',
}
```

关闭则直接将 `memory` 设为 `undefined`。

### 9.2 window 配置

字段含义：

1. `window.enabled`: 是否启用历史窗口。
2. `window.size`: 窗口大小。

约束：

1. 最小值 1。
2. 最大值 100。
3. 空值失焦后恢复默认 50。

### 9.3 query_prompt_template

这个字段由单独的 user editor 编辑。

规则：

1. Chat model 下如果设置了该字段，必须包含 `{{#sys.query#}}`。
2. 缺失时显示提示。
3. `default.ts` 也会在节点校验阶段拦截。

### 9.4 role_prefix

只在 `canSetRoleName = true` 时显示，也就是 Completion model 下允许设置。

这意味着当前产品逻辑认为：

1. Chat model 按标准 message role 工作，不需要自定义历史角色前缀。
2. Completion model 可能需要把历史对话拼成纯文本，因此需要用户定义 user / assistant 前缀。

## 10. Vision 设计细节

### 10.1 功能前提

是否支持视觉输入不是节点配置决定的，而是由模型能力决定的。

通过模型 feature 检测：

1. 当前模型 features 包含 `vision`，则 `isVisionModel = true`。
2. 否则开关置灰且不能开启。

### 10.2 开启后的默认行为

`useConfigVision` 在启用 vision 时会做默认注入：

1. 如果当前应用是 chat mode，默认绑定 `['sys', 'files']`。
2. 默认分辨率为 `high`。

### 10.3 模型切换后的修正

切模型后要重新判断：

1. 如果新模型不支持 vision，则自动关闭 vision，并删除 configs。
2. 如果新模型支持 vision 且之前 vision 已开启，则重置 configs 为默认结构。

复刻时这一步非常重要，不然会出现“不支持 vision 的模型却保留了旧 vision 配置”的脏状态。

## 11. 结构化输出设计细节

### 11.1 数据结构

结构化输出本质上就是一个 JSON Schema Root：

```ts
{
  schema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  }
}
```

### 11.2 模型能力检测

是否支持 structured output 由模型 feature 决定。

当前实现不会因为模型不支持就禁止用户打开开关，而是：

1. 如果开了 structured output。
2. 但当前模型不支持。
3. 则在开关旁展示 warning tooltip。

这意味着系统采用的是“软提醒，不强拦截”策略。

### 11.3 与调试态变量缓存的联动

当以下任一项变化时：

1. `structured_output_enabled`
2. `structured_output`

都会调用 `deleteNodeInspectorVars(id)`。

原因是结构化输出定义改变后，节点调试输出变量缓存可能过期，需要清空。

## 12. Reasoning Format 设计细节

这个功能很简单，但容易忽视其默认值语义。

字段：

1. `tagged`
2. `separated`

UI：

1. Switch 开启表示 `separated`
2. Switch 关闭表示 `tagged`

默认值：

1. 如果字段为空，UI 默认按 `tagged` 处理。
2. 注释中明确说明这是为了向后兼容。

## 13. 可用变量来源

LLMPanel 中多个区域都依赖“上游变量选择”，例如：

1. Context 变量
2. Prompt editor 内变量插入
4. Memory user prompt editor 中的变量插入
5. Vision 文件变量

这些变量不是写死的，而是通过 `useAvailableVarList(nodeId, options)` 动态计算。

变量来源包含：

1. 当前节点之前、同分支、可访问的前置节点输出。
2. 对话变量 `conversationVariables`。
3. 环境变量 `environmentVariables`。
4. RAG pipeline variables。
5. 数据源相关变量。
6. 插件工具与 workflow tools 的 schema 输出。

因此如果在别的项目复刻，不要把变量选择器实现成普通输入框，必须设计一层“变量解析与树形选择”的基础设施。

## 14. 节点校验规则

`default.ts` 中的 `checkValid` 至少包含以下规则。

### 14.1 模型必填

`payload.model.provider` 不能为空。

### 14.2 Prompt 必填

当 `memory` 未启用时，Prompt 不能为空。

不同模型的判定方式不同：

1. Chat model: message 数组里至少有一条非空文本。
2. Completion model: 单个 prompt 非空。
3. 如果是 jinja2 模式，则检查 `jinja2_text`。

### 14.3 Memory query 模板必须包含 `sys.query`

仅 chat model 下生效。


### 14.5 Vision 变量必填

如果 `vision.enabled = true`，则 `vision.configs.variable_selector` 不能为空。

复刻时建议把这套规则拆成纯函数，既用于前端即时提示，也用于最终保存校验。

## 15. 模型切换的完整行为清单

在别的项目复刻时，模型切换建议严格按下面顺序处理。

1. 用户在模型选择器里选中新的 provider / model / mode。
2. 读取当前 completion params。
3. 根据新模型拉取合法参数定义。
4. 清理旧参数中不再合法的项。
5. 如有移除项，提示用户哪些参数被自动删除。
6. 将清理后的 completion params 写回。
7. 写入新的 `model.provider`、`model.name`、`model.mode`。
8. 若 mode 发生变化，重置 prompt_template 为该 mode 对应默认模板。
9. 触发 vision 配置重算。
10. 保持其余字段不被无关覆盖。

## 16. 在另一个项目中复刻的推荐模块划分

如果你要在另一个项目实现相近界面，不建议只复制一个组件。建议按下面模块拆分。

### 16.1 数据模型层

最少需要定义：

1. `LLMNodeConfig`
2. `PromptItem`
3. `MemoryConfig`
4. `VisionConfig`
5. `StructuredOutputConfig`
6. `VariableSelector`
7. `VarTreeNode`

### 16.2 状态层

建议拆 3 类 state：

1. `persisted node state`
   - 真正保存到工作流 DSL 或节点 JSON 的状态。
2. `derived ui state`
   - 例如 `isChatModel`、`isShowVars`、`shouldShowContextTip`。
3. `ephemeral ui state`
   - 例如折叠状态、弹窗开关、rerender key。

### 16.3 业务 hook 层

建议实现一个类似 `useLLMPanelConfig` 的 hook，集中处理：

1. 数据派生。
2. 字段更新。
3. 模型切换副作用。
4. 默认值注入。
5. 校验逻辑。

### 16.4 基础组件层

建议抽成独立复用组件：

1. `ModelSelector / ModelParamEditor`
2. `VariableReferencePicker`
3. `PromptEditor`
4. `PromptMessageList`
5. `JinjaVariableList`
6. `MemoryEditor`
7. `VisionConfigEditor`
8. `StructuredOutputEditor`
9. `OutputVarsPanel`

### 16.5 外部能力层

至少需要对接以下外部能力：

1. 模型列表与模型 feature 查询。
2. 上游节点变量树。
3. 工作流节点数据写回。
4. 草稿保存或自动保存。
5. JSON Schema 编辑器。
6. 国际化或文案系统。

## 17. 推荐的实现顺序

如果从零开始做，建议按下面顺序实现。

### 第一阶段：先做数据和最小面板

1. 定义节点 schema。
2. 实现模型选择。
3. 实现 prompt 编辑。
4. 实现保存与回填。

### 第二阶段：补条件逻辑

1. 区分 chat / completion prompt 形态。
2. 补 context selector。
3. 补 jinja2 变量区。
4. 补 memory 开关和 window。

### 第三阶段：补高级能力

1. 补 vision。
2. 补 reasoning format。
3. 补 structured output。
4. 补 prompt generator。

### 第四阶段：补工程能力

1. 自动保存。
2. 参数兼容迁移。
3. 节点校验。
4. 只读态。
5. 调试缓存失效处理。

## 18. 最小复刻版本与高保真复刻版本的差异

### 18.1 最小复刻版本

如果只求功能类似，最少做这些：

1. 模型选择。
2. Chat / completion prompt 编辑。
3. Context 变量选择。
4. Memory 开关与窗口。
5. Vision 开关与文件变量选择。
6. Structured output 开关与 schema 编辑。

### 18.2 高保真复刻版本

如果希望接近当前 Dify 行为，还要补上：

1. completion params 清洗迁移。
2. Prompt block 检测。
3. Prompt generator。
5. system role 唯一限制。
6. message 拖拽排序。
7. 结构化输出不兼容模型的 warning。
8. 模型切换后的 vision 自动修正。
9. 调试变量缓存清理。
10. 默认 prompt 自动注入。

## 19. 容易踩坑的地方

1. 不要把 chat model 和 completion model 的 prompt 存成同一种结构却不做转换，否则 UI 代码会越来越混乱。
2. 不要在模型切换时只更新 model 字段，必须处理 prompt、vision、completion params 的联动。
3. Jinja2 变量列表不是简单展示，它和模板字符串改名是联动的。
4. Memory 的 `query_prompt_template` 不是普通备注字段，它有强约束，必须包含 `{{#sys.query#}}`。
5. structured output 修改后要让调试态或推导变量缓存失效。
6. 变量选择器背后需要一整套工作流变量解析能力，不能临时硬编码。
7. 只读态必须在底层更新函数拦截，而不只是把 UI 置灰。

## 20. 适合直接交给大模型实现的任务描述模板

如果你要在另一个项目中让大模型直接实现，可以给它下面这类约束。

```md
实现一个 LLM 配置面板，包含以下能力：

1. 模型选择与 completion params 编辑。
2. 区分 chat model 和 completion model。
3. chat model 使用 message list prompt，支持 system/user/assistant 角色、拖拽排序、basic/jinja2 两种编辑模式。
4. completion model 使用单段 prompt，支持 basic/jinja2 两种编辑模式。
5. context 支持从上游节点变量中选择一个变量源。
6. jinja2 模式下，维护模板变量列表，变量名改动时同步替换 prompt 中的 `{{ varName }}`。
7. memory 支持总开关、window 开关、window size、query prompt template；chat model 下 query prompt 必须包含 `{{#sys.query#}}`。
8. vision 只在模型支持时可开启；开启后可选择文件变量和分辨率。
9. reasoning format 支持 `tagged` 和 `separated`。
10. structured output 支持开关和 JSON Schema object 配置。
11. 所有配置实时写回节点持久状态，并触发草稿自动保存。
12. 模型切换时要清洗不兼容的 completion params，并处理 prompt 与 vision 的联动重置。
13. 提供前端校验：模型必填、prompt 必填、jinja2 变量完整性、vision 文件变量必填、memory query 模板必须含 `{{#sys.query#}}`。
```

## 21. 结论

当前 LLMPanel 的本质不是一个“表单组件”，而是一个“工作流节点配置编排器”。

它有三个关键特征：

1. 强条件渲染：很多区块由应用模式、模型模式、模型 feature、字段值共同决定。
2. 强联动：模型切换会影响 prompt 结构、completion params、vision 配置。
3. 强状态基础设施依赖：变量树、节点写回、草稿同步、模型能力查询、调试缓存等都不是面板内部能独立完成的。

如果在另一个项目里复刻，建议优先复刻这三层能力：

1. 节点持久化状态模型。
2. 变量与模型能力基础设施。
3. `useConfig` 这一层集中式业务编排。

只要这三层做对，UI 反而是最容易还原的一部分。

## 22. 工程落地任务拆解

这一节不是概念说明，而是适合直接进入项目管理工具的开发任务拆分。建议按阶段建立 Epic，再把子项拆到具体开发任务。

### 22.1 Epic A：领域模型与节点存储

目标：先把 LLM 节点配置的数据模型、默认值、校验和持久化接口定义稳定下来。

任务清单：

1. 定义 `LLMNodeConfig`、`PromptItem`、`MemoryConfig`、`VisionConfig`、`StructuredOutputConfig`、`VariableBinding` 等类型。
2. 定义 chat model 与 completion model 对应的 `prompt_template` 联合类型。
3. 定义节点默认值生成函数。
4. 定义节点校验函数，覆盖模型必填、prompt 必填、memory query 约束、vision 变量约束、jinja2 变量完整性。
5. 定义节点序列化与反序列化策略，如果目标项目有 DSL 或后端 schema，需要在这一层完成适配。
6. 定义节点更新接口，明确是“整对象替换”还是“局部 patch”。

验收标准：

1. 在不渲染 UI 的情况下，可以独立构造出一个合法的 LLM 节点配置对象。
2. 对非法配置输入，校验函数能返回稳定且可消费的错误结构。
3. 切换 chat/completion 模式时，`prompt_template` 的数据形态可正确转换。

### 22.2 Epic B：模型能力基础设施

目标：把模型列表、模型特性、completion params 清洗逻辑独立出来，避免散落在 UI 中。

任务清单：

1. 实现模型列表查询接口。
2. 定义模型特性字段，例如 `vision`、`structured_output`、`tool_call` 等。
3. 实现模型默认值获取逻辑。
4. 实现 `completion params` 合法性过滤器。
5. 实现模型切换迁移器，负责在模型切换时执行参数清洗、prompt 重置、vision 修正。
6. 定义模型查询失败时的降级行为。

验收标准：

1. 给定旧模型参数和新模型能力描述，可以返回清洗后的参数和被移除的字段清单。
2. UI 层不需要知道参数过滤细节，只需要消费结果。
3. vision 与 structured output 的可用性可以从模型特性稳定推导。

### 22.3 Epic C：工作流变量系统

目标：提供一个面板可直接消费的“可用变量树”，服务于 context、vision、prompt、jinja2 绑定等多个区域。

任务清单：

1. 定义变量节点结构，例如 `VarTreeNode`。
2. 实现“当前节点可访问哪些上游节点”的解析逻辑。
3. 实现变量来源聚合，至少包含前置节点输出、环境变量、会话变量、RAG 变量。
4. 实现变量类型过滤器，支持字符串、数值、对象、文件、数组文件等。
5. 实现变量选择器需要的树形数据格式。
6. 定义变量选择值 `value_selector` 的编码方案。

验收标准：

1. Context 和 Vision 可以分别拿到不同过滤条件下的变量列表。
2. Prompt editor 是一套变量基础设施。
3. 新增一种变量来源时，不需要改动面板业务代码。

### 22.4 Epic D：Prompt 编辑系统

目标：先把最复杂的 Prompt 子系统独立成可复用模块。

任务清单：

1. 实现单段 Prompt editor。
2. 实现 message list Prompt editor。
3. 实现 role 切换。
4. 实现 basic / jinja2 双模式编辑。
5. 实现消息拖拽排序。
6. 实现 system role 唯一限制。
7. 实现插入 block 与插入变量能力。
8. 实现 Prompt block 检测函数。
9. 实现 prompt generator 接口接入。
10. 实现变量改名时对 Prompt 中 `{{ var }}` 的同步替换。

验收标准：

1. Chat model 下 message list 可以稳定增删改排。
2. Completion model 下单段 Prompt 可以切换编辑模式并正确保存。
3. 切换模型模式后，Prompt UI 和底层数据结构始终一致。

### 22.5 Epic E：面板业务编排 Hook

目标：实现一个类似 `useLLMPanelConfig` 的集中式 hook，把所有推导状态和 handler 收口。

任务清单：

1. 将节点数据包装为可编辑对象。
2. 提供所有字段级更新 handler。
3. 提供衍生状态，例如 `isChatModel`、`isVisionModel`、`isShowVars`。
4. 实现默认 prompt 自动注入。
5. 实现模型切换副作用。
6. 实现结构化输出变更后的调试缓存失效。
7. 实现只读态底层拦截。

验收标准：

1. `Panel` 组件本身只负责布局和透传 props。
2. 大部分业务判断都从 hook 中读取，而不是散落在 JSX。
3. 任意字段更新后都能稳定回写到节点持久状态。

### 22.6 Epic F：面板 UI 组装

目标：将各子模块装配成最终的 LLMPanel。

任务清单：

1. 实现 Model 区块。
2. 实现 Context 区块。
3. 实现 Prompt 区块。
5. 实现 Memory 区块。
6. 实现 Vision 区块。
7. 实现 Reasoning Format 区块。
8. 实现 OutputVars 区块。
9. 实现 Structured Output 区块。
10. 实现各种 tooltip、warning、disabled 状态。

验收标准：

1. 各区块显示条件与当前 Dify 行为一致。
2. 只读态下 UI 和底层更新都被正确限制。
3. 所有字段变化都能在 UI 上即时反映。

### 22.7 Epic G：测试与回归

目标：为复刻版本补足最小可维护测试集。

任务清单：

1. 为默认值与校验函数写单元测试。
2. 为模型切换迁移逻辑写单元测试。
3. 为 `useLLMPanelConfig` 写 hook 测试。
4. 为 Prompt 编辑器写交互测试。
5. 为关键条件渲染写组件测试。
6. 为 structured output 变更触发缓存失效写测试。
7. 为只读态拦截写测试。

验收标准：

1. 最关键的联动逻辑不依赖手工回归。
2. 切模型、切编辑模式、开关 vision、开关 structured output 都有自动化覆盖。

## 23. 初始代码骨架建议

这一节给出的是一个适合“另一个项目从 0 到 1 起步”的代码结构示例。不是要求逐字照搬，而是帮助大模型或工程师快速进入正确的抽象层级。

### 23.1 推荐目录结构

```text
src/
  features/llm-panel/
    components/
      LLMPanel.tsx
      ModelConfigSection.tsx
      ContextSection.tsx
      PromptSection.tsx
      PromptMessageList.tsx
      PromptMessageItem.tsx
      JinjaVariableSection.tsx
      MemorySection.tsx
      MemoryQueryEditor.tsx
      VisionSection.tsx
      ReasoningFormatSection.tsx
      OutputSection.tsx
      StructuredOutputSection.tsx
    hooks/
      use-llm-panel-config.ts
      use-model-capabilities.ts
      use-available-vars.ts
    schema/
      llm-node-schema.ts
      llm-node-defaults.ts
      llm-node-validation.ts
    services/
      model-service.ts
      variable-service.ts
      draft-service.ts
    utils/
      prompt-template.ts
      jinja-variable.ts
      structured-output.ts
    types.ts
```

### 23.2 推荐类型定义骨架

```ts
export type ValueSelector = string[]

export type VariableBinding = {
  variable: string
  valueSelector: ValueSelector
}

export type PromptRole = 'system' | 'user' | 'assistant'
export type PromptEditionType = 'basic' | 'jinja2'

export type ChatPromptItem = {
  id: string
  role: PromptRole
  text: string
  editionType?: PromptEditionType
  jinja2Text?: string
}

export type CompletionPromptItem = {
  text: string
  editionType?: PromptEditionType
  jinja2Text?: string
}

export type MemoryConfig = {
  rolePrefix?: {
    user: string
    assistant: string
  }
  window: {
    enabled: boolean
    size: number | null
  }
  queryPromptTemplate: string
}

export type VisionConfig = {
  enabled: boolean
  configs?: {
    detail: 'high' | 'low' | 'auto'
    variableSelector: ValueSelector
  }
}

export type StructuredField = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  properties?: Record<string, StructuredField>
  required?: string[]
  items?: StructuredField
  enum?: Array<string | number>
  additionalProperties?: false
}

export type StructuredOutputConfig = {
  schema: {
    type: 'object'
    properties: Record<string, StructuredField>
    required?: string[]
    additionalProperties: false
  }
}

export type ModelConfig = {
  provider: string
  name: string
  mode: 'chat' | 'completion'
  completionParams: Record<string, unknown>
}

export type LLMNodeConfig = {
  model: ModelConfig
  promptTemplate: ChatPromptItem[] | CompletionPromptItem
  promptConfig?: {
    jinja2Variables?: VariableBinding[]
  }
  memory?: MemoryConfig
  context: {
    enabled: boolean
    variableSelector: ValueSelector
  }
  vision: VisionConfig
  structuredOutputEnabled?: boolean
  structuredOutput?: StructuredOutputConfig
  reasoningFormat?: 'tagged' | 'separated'
}
```

### 23.3 默认值函数骨架

```ts
export function createDefaultLLMNodeConfig(): LLMNodeConfig {
  return {
    model: {
      provider: '',
      name: '',
      mode: 'chat',
      completionParams: { temperature: 0.7 },
    },
    promptTemplate: [
      {
        id: crypto.randomUUID(),
        role: 'system',
        text: '',
      },
    ],
    context: {
      enabled: false,
      variableSelector: [],
    },
    vision: {
      enabled: false,
    },
  }
}
```

### 23.4 校验函数骨架

```ts
export type ValidationIssue = {
  path: string
  message: string
}

export function validateLLMNodeConfig(config: LLMNodeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!config.model.provider)
    issues.push({ path: 'model.provider', message: 'Model is required.' })

  if (!hasPromptContent(config))
    issues.push({ path: 'promptTemplate', message: 'Prompt is required.' })

  if (config.memory?.queryPromptTemplate && config.model.mode === 'chat') {
    if (!config.memory.queryPromptTemplate.includes('{{#sys.query#}}'))
      issues.push({ path: 'memory.queryPromptTemplate', message: 'Memory query prompt must contain {{#sys.query#}}.' })
  }

  if (config.vision.enabled && !config.vision.configs?.variableSelector?.length)
    issues.push({ path: 'vision.configs.variableSelector', message: 'Vision variable is required.' })

  for (const item of config.promptConfig?.jinja2Variables || []) {
    if (!item.variable)
      issues.push({ path: 'promptConfig.jinja2Variables.variable', message: 'Variable name is required.' })
    if (!item.valueSelector.length)
      issues.push({ path: 'promptConfig.jinja2Variables.valueSelector', message: 'Variable binding is required.' })
  }

  return issues
}
```

### 23.5 业务 Hook 骨架

```ts
type UseLLMPanelConfigOptions = {
  nodeId: string
  value: LLMNodeConfig
  readOnly?: boolean
  onChange: (nextValue: LLMNodeConfig) => void
  onInvalidateDebugCache?: (nodeId: string) => void
}

export function useLLMPanelConfig(options: UseLLMPanelConfigOptions) {
  const { nodeId, value, readOnly = false, onChange, onInvalidateDebugCache } = options

  const isChatModel = value.model.mode === 'chat'
  const isCompletionModel = !isChatModel
  const isShowVars = getIsShowVars(value.promptTemplate)

  function update(recipe: (draft: LLMNodeConfig) => void) {
    if (readOnly)
      return

    const nextValue = structuredClone(value)
    recipe(nextValue)
    onChange(nextValue)
  }

  function handleModelChange(nextModel: ModelConfig) {
    update((draft) => {
      const modeChanged = draft.model.mode !== nextModel.mode
      draft.model = nextModel
      if (modeChanged)
        draft.promptTemplate = createPromptTemplateForMode(nextModel.mode)
      draft.vision = reconcileVisionConfig(draft.vision, nextModel)
    })
  }

  function handleStructuredOutputEnabledChange(enabled: boolean) {
    update((draft) => {
      draft.structuredOutputEnabled = enabled
    })
    onInvalidateDebugCache?.(nodeId)
  }

  function handleStructuredOutputChange(nextOutput: StructuredOutputConfig) {
    update((draft) => {
      draft.structuredOutput = nextOutput
    })
    onInvalidateDebugCache?.(nodeId)
  }

  return {
    value,
    readOnly,
    isChatModel,
    isCompletionModel,
    isShowVars,
    handleModelChange,
    handleStructuredOutputEnabledChange,
    handleStructuredOutputChange,
  }
}
```

### 23.6 面板组件骨架

```tsx
type LLMPanelProps = {
  nodeId: string
  value: LLMNodeConfig
  readOnly?: boolean
  onChange: (nextValue: LLMNodeConfig) => void
}

export function LLMPanel(props: LLMPanelProps) {
  const config = useLLMPanelConfig(props)

  return (
    <div className="llm-panel">
      <ModelConfigSection
        value={config.value.model}
        readOnly={config.readOnly}
        onChange={config.handleModelChange}
      />

      <ContextSection />

      <PromptSection
        isChatModel={config.isChatModel}
        value={config.value.promptTemplate}
      />

      {config.isShowVars && <JinjaVariableSection />}

      <MemorySection />
      <VisionSection />
      <ReasoningFormatSection />
      <OutputSection />
    </div>
  )
}
```

### 23.7 Prompt 子模块骨架

```tsx
type PromptSectionProps = {
  isChatModel: boolean
  value: ChatPromptItem[] | CompletionPromptItem
  onChange: (nextValue: ChatPromptItem[] | CompletionPromptItem) => void
}

export function PromptSection(props: PromptSectionProps) {
  if (props.isChatModel) {
    return (
      <PromptMessageList
        items={props.value as ChatPromptItem[]}
        onChange={items => props.onChange(items)}
      />
    )
  }

  return (
    <SinglePromptEditor
      value={props.value as CompletionPromptItem}
      onChange={item => props.onChange(item)}
    />
  )
}
```

### 23.8 变量选择器接口骨架

```ts
export type VarTreeNode = {
  id: string
  label: string
  valueSelector?: ValueSelector
  valueType?: string
  children?: VarTreeNode[]
}

export type VariableService = {
  getAvailableVars(params: {
    nodeId: string
    filter?: (node: VarTreeNode) => boolean
  }): Promise<VarTreeNode[]>
}
```

### 23.9 模型服务接口骨架

```ts
export type ModelFeature = 'vision' | 'structured_output'

export type ModelDescriptor = {
  provider: string
  model: string
  mode: 'chat' | 'completion'
  features: ModelFeature[]
}

export type FilterCompletionParamsResult = {
  params: Record<string, unknown>
  removedDetails: Record<string, string>
}

export type ModelService = {
  listModels(): Promise<ModelDescriptor[]>
  filterCompletionParams(args: {
    provider: string
    model: string
    currentParams: Record<string, unknown>
  }): Promise<FilterCompletionParamsResult>
}
```

### 23.10 建议先生成哪些文件

如果要让大模型直接起草第一版代码，建议优先生成以下文件：

1. `types.ts`
2. `schema/llm-node-defaults.ts`
3. `schema/llm-node-validation.ts`
4. `hooks/use-llm-panel-config.ts`
5. `components/LLMPanel.tsx`
6. `components/PromptSection.tsx`
7. `components/MemorySection.tsx`
8. `components/VisionSection.tsx`
9. `components/StructuredOutputSection.tsx`

原因：

1. 这组文件已经能支撑一个最小可编辑面板。
2. Prompt 是最复杂的模块，应该尽早独立。
3. 类型、默认值、校验先稳定下来，后面继续加 UI 成本会小很多。

## 24. 建议的大模型执行提示词补充

如果你希望大模型不仅“写一个类似面板”，而是“按工程化方式逐步落地”，可以在第 20 节的任务描述后面追加这些约束。

```md
额外要求：

1. 先生成类型定义、默认值函数、校验函数，再生成 UI 组件。
2. 所有 UI 组件尽量保持无状态，业务逻辑集中到 `useLLMPanelConfig`。
3. 模型切换的副作用必须集中在一个迁移函数里，不要散落在多个组件里。
4. Prompt 必须拆分为 chat message list 和 completion single prompt 两个子模块。
5. 变量选择器不要写死，保留成基于 `valueSelector` 的通用接口。
6. structured output 的 schema 配置要和普通输出区解耦。
7. 需要为校验函数和模型切换迁移函数生成单元测试。
8. 先输出目录结构和文件清单，再输出文件内容。
```