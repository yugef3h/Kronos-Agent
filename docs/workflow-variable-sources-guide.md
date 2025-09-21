# Workflow 变量来源与维护说明

这份文档回答两个问题：

1. LLM 节点里的 `text`、`reasoning_content` 为什么会变成后续 workflow 节点可选变量。
2. Dify workflow 里“可选变量”到底有哪些来源，分别怎么定义、聚合、显示、运行时解析，以及后续怎么维护。

## 1. 先回答当前问题：`text` / `reasoning_content` 为什么能被后续节点选到

结论先说：

- `panel.tsx` 里的 `VarItem` 主要是“面板展示”。
- 真正决定“这个节点会对下游暴露哪些变量”的 source of truth，不是 `panel.tsx`，而是 workflow 变量系统里的输出结构定义与聚合逻辑。
- 对 LLM 节点来说，真正的定义在 `web/app/components/workflow/constants.ts` 里的 `LLM_OUTPUT_STRUCT`。

链路如下：

### 1.1 LLM 输出结构的真实定义

`web/app/components/workflow/constants.ts`

- `LLM_OUTPUT_STRUCT` 定义了 LLM 节点固定输出：
  - `text`
  - `reasoning_content`
  - `usage`

也就是说，下游变量系统真正认的是这里，不是面板里写死的 `VarItem`。

### 1.2 节点输出如何被汇总成“可选变量”

`web/app/components/workflow/nodes/_base/components/variable/utils.ts`

- `formatItem(...)` 在 `BlockEnum.LLM` 分支里，把 `LLM_OUTPUT_STRUCT` 变成当前 LLM 节点的输出变量集合。
- 如果开启了 structured output，还会额外追加 `structured_output`，并带上 schema 子结构。

### 1.3 下游节点为什么能看到它们

`web/app/components/workflow/nodes/_base/hooks/use-available-var-list.ts`

- 当前节点会调用 `useAvailableVarList(...)`。
- 这个 hook 会先找“当前节点所在分支里、在它之前的节点”。
- 然后调用 `useWorkflowVariables().getNodeAvailableVars(...)`。

`web/app/components/workflow/hooks/use-workflow-variables.ts`

- `getNodeAvailableVars(...)` 会把以下来源统一喂给 `toNodeAvailableVars(...)`：
  - 上游节点 outputs
  - 环境变量
  - 会话变量
  - RAG pipeline 变量
  - 系统变量

`web/app/components/workflow/nodes/_base/components/variable/utils.ts`

- `toNodeAvailableVars(...)` 最终产出 `NodeOutPutVar[]`。
- 变量选择器、提示输入、prompt editor、条件编辑器，拿到的都是这套聚合后的数据。

### 1.4 运行时为什么真的能取到值

编辑态只是“能选”。运行时能不能取到，取决于后端 variable pool。

`api/dify_graph/graph_engine/event_management/event_handlers.py`

- 节点成功执行后，`NodeRunSucceededEvent` 会调用 `_store_node_outputs(...)`。
- `_store_node_outputs(...)` 会把 `outputs` 逐项写进 `variable_pool`：
  - `(node_id, 'text')`
  - `(node_id, 'reasoning_content')`
  - `(node_id, 'usage')`

`api/dify_graph/runtime/variable_pool.py`

- 后续节点按 selector 读取，例如 `[llmNodeId, 'text']`。
- 如果是对象/文件，还支持继续向下取子路径。

所以，`text` / `reasoning_content` 成为下游变量，完整链路是：

1. 前端常量定义输出结构。
2. 前端聚合逻辑把它们放进变量选择器。
3. 后端节点执行完成后，把同名 outputs 写入 variable pool。
4. 下游节点通过 selector 读取。

## 2. Dify workflow 里可选变量的完整来源

从“当前节点能拉取到什么变量”这个角度看，来源可以分成 8 类。

## 2.1 开始节点用户输入

来源：Start 节点配置的 `variables`。

定义位置：

- `web/app/components/workflow/nodes/start/types.ts`
- `web/app/components/workflow/nodes/_base/components/variable/utils.ts` 的 `BlockEnum.Start`

暴露方式：

- Start 节点的每个输入字段都会被转成一个 output var。
- 例如开始节点里有 `topic`、`language`、`attachments`，下游就可以引用：
  - `[startNodeId, 'topic']`
  - `[startNodeId, 'language']`

类型来源：

- `InputVarType` 转成 `VarType`。
- `json_object` 会尝试挂上 schema，供对象子字段选择。

运行时写入：

- `api/core/workflow/workflow_entry.py` 的 `mapping_user_inputs_to_variable_pool(...)`
- `api/services/workflow_service.py` 的 `_setup_variable_pool(...)`

## 2.2 Start 节点系统输入变量

这类变量在前端被归到 Start 节点下面，不归到“全局系统变量”分组。

包括：

- `sys.query`
- `sys.files`

定义位置：

- `web/app/components/workflow/nodes/_base/components/variable/utils.ts` 的 `BlockEnum.Start`

规则：

- `sys.query` 只在 chat mode 下追加。
- `sys.files` 始终作为 Start 可用变量暴露。

典型 selector：

- `[startNodeId, 'sys.query']`
- `[startNodeId, 'sys.files']`

运行时来源：

- `api/services/workflow_service.py` 的 `_setup_variable_pool(...)`
- `api/dify_graph/runtime/variable_pool.py` 在初始化时把系统变量放进 pool。

补充：

- 知识检索节点默认会把 `query_variable_selector` 指到 `[startNodeId, 'sys.query']`。
- 相关前端逻辑在 `web/app/components/workflow/nodes/knowledge-retrieval/use-config.ts`。

## 2.3 全局系统变量

这类变量在前端会单独归到 `SYSTEM` 分组。

定义位置：

- `web/app/components/workflow/constants.ts` 的 `getGlobalVars(...)`

当前包含：

- chat mode 专属：
  - `sys.dialogue_count`
  - `sys.conversation_id`
- 通用：
  - `sys.user_id`
  - `sys.app_id`
  - `sys.workflow_id`
  - `sys.workflow_run_id`
- workflow 页面非 chat mode 专属：
  - `sys.timestamp`

注意：

- `sys.query` 和 `sys.files` 不在这里，它们被当成 Start 节点输出处理。

运行时来源：

- `api/services/workflow_service.py` 的 `_setup_variable_pool(...)`
- `api/dify_graph/runtime/variable_pool.py`

## 2.4 环境变量

这类变量是 workflow 级配置，前端归到 `ENVIRONMENT` 分组。

前端维护入口：

- store: `web/app/components/workflow/store/workflow/env-variable-slice.ts`
- 面板: `web/app/components/workflow/panel/env-panel/index.tsx`

聚合位置：

- `web/app/components/workflow/hooks/use-workflow-variables.ts`
- `web/app/components/workflow/nodes/_base/components/variable/utils.ts`

典型 selector：

- `['env', 'API_KEY']`

运行时来源：

- `api/services/workflow_service.py` 初始化 `VariablePool` 时注入 `workflow.environment_variables`
- `api/dify_graph/runtime/variable_pool.py` 初始化时写入 `env.*`

## 2.5 会话变量 / Conversation Variables

这类变量只在 chat mode 下进入可选变量集合，前端归到 `CONVERSATION` 分组。

前端维护入口：

- store: `web/app/components/workflow/store/workflow/chat-variable-slice.ts`
- 面板: `web/app/components/workflow/panel/chat-variable-panel/index.tsx`

聚合位置：

- `web/app/components/workflow/hooks/use-workflow-variables.ts`
- `web/app/components/workflow/nodes/_base/components/variable/utils.ts`

典型 selector：

- `['conversation', 'session_name']`

运行时来源：

- `VariablePool` 初始化时注入 conversation variables。
- 持久化相关逻辑在后端 conversation variable layer。

## 2.6 RAG / 知识检索相关变量

这里分两种，不要混在一起。

### 2.6.1 Knowledge Retrieval 节点输出

这是普通节点输出。

定义位置：

- `web/app/components/workflow/constants.ts` 的 `KNOWLEDGE_RETRIEVAL_OUTPUT_STRUCT`

当前固定输出：

- `result`

典型 selector：

- `[knowledgeNodeId, 'result']`

运行时来源：

- `api/core/workflow/nodes/knowledge_retrieval/knowledge_retrieval_node.py`
- 节点成功后输出 `{"result": ...}`，再由 graph engine 写入 variable pool。

### 2.6.2 RAG pipeline shared inputs / Data Source 专属 RAG 变量

这不是普通节点 outputs，而是 RAG pipeline 注入的特殊变量。

前端来源：

- `ragPipelineVariables` 来自 `web/app/components/rag-pipeline/store/index.ts`
- 通过 workflow store 的注入切片并入 workflow 变量体系

聚合规则：

- shared 级变量会进入 `SHARED INPUTS` 分组
- Data Source 节点下的专属 RAG 变量会带上：
  - `rag.<nodeId>.<variable>`

相关聚合代码：

- `web/app/components/workflow/nodes/_base/components/variable/utils.ts`
- `web/app/components/workflow/nodes/_base/hooks/use-available-var-list.ts`

典型 selector：

- `['rag', 'shared', 'query_text']`
- `['rag', dataSourceNodeId, 'document_id']`

## 2.7 迭代 / 循环上下文变量

这类变量不是节点面板里单独配置出来的，而是上下文自动生成。

定义位置：

- `web/app/components/workflow/nodes/_base/components/variable/utils.ts`

当前包含：

- Iteration 内部：
  - `item`
  - `index`
- Loop 内部：
  - `item`
  - `index`

类型规则：

- `item` 的类型从 iterator selector 对应变量的数组元素类型推导。
- 文件数组会自动补充 file 子字段。

## 2.8 上游节点 outputs

这是最大的一类。并不是所有节点都能对下游暴露变量，只有进入 `SUPPORT_OUTPUT_VARS_NODE` 的节点才会被聚合进可选变量列表。

定义位置：

- `web/app/components/workflow/constants.ts` 的 `SUPPORT_OUTPUT_VARS_NODE`

当前支持输出变量的节点包括：

- `Start`
- `TriggerWebhook`
- `TriggerPlugin`
- `LLM`
- `KnowledgeRetrieval`
- `Code`
- `TemplateTransform`
- `HttpRequest`
- `Tool`
- `VariableAssigner`
- `VariableAggregator`
- `QuestionClassifier`
- `ParameterExtractor`
- `Iteration`
- `Loop`
- `DocExtractor`
- `ListFilter`
- `Agent`
- `DataSource`
- `HumanInput`

下面是每类节点 outputs 的定义来源。

### Start

- 来源：节点配置的 `variables`，外加 `sys.query` / `sys.files`
- 维护位置：`variable/utils.ts` 的 `BlockEnum.Start`

### TriggerWebhook

- 来源：trigger webhook 节点自己的 `variables`
- 维护位置：`variable/utils.ts` 的 `BlockEnum.TriggerWebhook`

### TriggerPlugin

- 来源：节点配置里的 `output_schema`
- 维护位置：`web/app/components/workflow/nodes/trigger-plugin/default.ts`
- 特点：schema-driven

### LLM

- 来源：固定结构 `LLM_OUTPUT_STRUCT`
- 额外来源：`structured_output` schema
- 维护位置：
  - `web/app/components/workflow/constants.ts`
  - `variable/utils.ts` 的 `BlockEnum.LLM`

### KnowledgeRetrieval

- 来源：固定结构 `KNOWLEDGE_RETRIEVAL_OUTPUT_STRUCT`
- 当前输出：`result`

### Code

- 来源：节点配置里的 `outputs`
- 维护位置：`variable/utils.ts` 的 `BlockEnum.Code`
- 特点：完全动态

### TemplateTransform

- 来源：固定结构 `TEMPLATE_TRANSFORM_OUTPUT_STRUCT`
- 当前输出：`output`

### QuestionClassifier

- 来源：固定结构 `QUESTION_CLASSIFIER_OUTPUT_STRUCT`
- 当前输出：
  - `class_name`
  - `usage`

### HttpRequest

- 来源：固定结构 `HTTP_REQUEST_OUTPUT_STRUCT`
- 当前输出：
  - `body`
  - `status_code`
  - `headers`
  - `files`

### VariableAssigner / VariableAggregator

- 来源：节点配置
- 非 group 模式：输出 `output`
- group 模式：输出 `group_name.output`
- 维护位置：`variable/utils.ts`

### Tool

- 来源：tool 插件的 `output_schema`
- 同时追加通用输出：
  - `text`
  - `files`
  - `json`
- 维护位置：`web/app/components/workflow/nodes/tool/default.ts`

### ParameterExtractor

- 来源：节点配置里的 `parameters`
- 还会追加公共字段：
  - `__is_success`
  - `__reason`
  - `__usage`
- 维护位置：
  - `variable/utils.ts`
  - `web/app/components/workflow/constants.ts`

### Iteration

- 来源：节点配置里的 `output_type`
- 当前输出：`output`

### Loop

- 来源：节点配置里的 `loop_variables`
- 当前输出：每个 loop variable 单独暴露

### DocExtractor

- 来源：节点配置 `is_array_file`
- 当前输出：`text`
- 类型可能是 `string` 或 `arrayString`

### ListFilter

- 来源：节点配置 `var_type` / `item_var_type`
- 当前输出：
  - `result`
  - `first_record`
  - `last_record`

### Agent

- 来源：节点配置里的 `output_schema`
- 另外还会追加 tool-like 通用输出和 `usage`
- 维护位置：`variable/utils.ts` 的 `BlockEnum.Agent`

### DataSource

- 来源：data source 插件的 `output_schema`
- 另外还会追加：
  - `datasource_type`
  - 本地文件模式下的 `file`
  - RAG 专属变量
- 维护位置：
  - `web/app/components/workflow/nodes/data-source/default.ts`
  - `web/app/components/workflow/nodes/data-source/constants.ts`

### HumanInput

- 来源：节点 inputs 的 `output_variable_name`
- 另外还会追加：
  - `__action_id`
  - `__rendered_content`
- 维护位置：
  - `web/app/components/workflow/nodes/human-input/default.ts`
  - `web/app/components/workflow/constants.ts`

## 3. 当前节点为什么只能看到“部分变量”

变量不是全量暴露给所有节点，而是受可见范围约束。

核心规则在：

- `web/app/components/workflow/hooks/use-workflow.ts`
- `web/app/components/workflow/nodes/_base/hooks/use-available-var-list.ts`

规则如下：

- 默认只取“当前节点所在分支里、它之前的节点”。
- 在 iteration / loop 内，会额外把父容器节点上下文带进来。
- Data Source 节点会额外拼接当前节点专属的 RAG 变量。
- 变量还会经过 `filterVar(...)` 二次过滤，所以不同控件看到的变量类型可能不一样。
- 某些场景会主动隐藏 env/chat/system 变量，例如 assigner 一类控件。

这也是为什么：

- 同一个 workflow 里，不同节点打开变量选择器，看到的列表不完全相同。
- 同一个节点，不同字段的变量选择弹窗，看到的类型过滤结果也不一样。

## 4. 编辑态与运行态的职责分工

建议把整个体系拆成 3 层理解。

### 4.1 定义层

负责回答“一个节点理论上会产出哪些变量”。

主要文件：

- `web/app/components/workflow/constants.ts`
- 各节点 `default.ts`
- `web/app/components/workflow/nodes/_base/components/variable/utils.ts`

### 4.2 聚合层

负责回答“当前这个节点此刻能看到哪些变量”。

主要文件：

- `web/app/components/workflow/hooks/use-workflow.ts`
- `web/app/components/workflow/hooks/use-workflow-variables.ts`
- `web/app/components/workflow/nodes/_base/hooks/use-available-var-list.ts`

### 4.3 运行层

负责回答“用户选中的 selector 在执行时怎么取到真实值”。

主要文件：

- `api/dify_graph/runtime/variable_pool.py`
- `api/dify_graph/graph_engine/event_management/event_handlers.py`
- `api/core/workflow/workflow_entry.py`
- `api/services/workflow_service.py`

## 5. 这套机制怎么维护

如果只想保证“UI 看起来对”，改 `panel.tsx` 不够。

正确维护方式是按下面的层次改。

## 5.1 新增或修改一个节点输出变量

如果节点输出是固定结构：

- 优先改 `web/app/components/workflow/constants.ts`
- 再确认 `variable/utils.ts` 的对应 `BlockEnum` 分支有引用这份结构

如果节点输出是动态 schema：

- 改对应节点的 `default.ts` 里的 `getOutputVars(...)`
- 确保 schema 能转成 `Var[]`

如果节点面板里有 output 展示：

- 再同步改 panel 里的 `OutputVars` / `VarItem`

注意：

- 面板展示和实际 picker 聚合是两套代码路径。
- 如果只改面板不改聚合 source of truth，就会出现“面板看到 A，但下游选不到 A”的漂移。
- 如果只改聚合不改面板，就会出现“下游能选到 A，但面板没展示 A”的漂移。

LLM 当前就属于一个容易漂移的例子：

- 面板里手写了 `text` / `reasoning_content` / `usage`
- 聚合层里又有一份 `LLM_OUTPUT_STRUCT`

这意味着后续如果调整 LLM 输出字段，最好同时检查这两处。

## 5.2 新增一种“特殊变量来源”

例如新增一个像 `env`、`conversation`、`rag` 这样的独立变量命名空间，需要同时处理：

1. selector 前缀约定
2. 前端聚合分组
3. 类型推导
4. 运行时 variable pool 初始化或更新
5. prompt/editor/selector 对该前缀的识别

最关键的入口文件：

- `web/app/components/workflow/nodes/_base/components/variable/utils.ts`
- `api/dify_graph/runtime/variable_pool.py`

## 5.3 新增一个支持下游引用的节点类型

最少要做 4 件事：

1. 把节点类型加入 `SUPPORT_OUTPUT_VARS_NODE`
2. 在 `formatItem(...)` 或节点 `default.ts.getOutputVars(...)` 中产出 `Var[]`
3. 确保运行时节点 `outputs` 字段和前端定义同名
4. 如果需要，在节点面板里补 `OutputVars` 展示

否则会出现两类常见错误：

- 编辑态能运行，但下游选不到这个节点输出
- 编辑态能选到，但运行时 variable pool 没有对应 key

## 6. 对外项目复刻时的建议

如果别的项目想复刻这套能力，建议不要从 UI 组件抄起，而是先抽象这 5 个概念：

1. `Var`
   - 描述单个变量的名称、类型、schema、是否文件、是否异常变量等。
2. `NodeOutPutVar`
   - 描述一个节点能暴露出的变量分组。
3. `ValueSelector`
   - 用路径表达变量引用，例如 `[nodeId, 'text']`、`['env', 'API_KEY']`。
4. `VariablePool`
   - 运行时实际存值的地方。
5. `AvailableVarResolver`
   - 根据当前节点位置、分支、上下文，算出“当前能看到哪些变量”。

如果这 5 层分开，系统会比较稳定：

- UI 只负责展示 picker
- 聚合器负责算可见范围
- 节点 schema 负责声明输出
- runtime pool 负责存取值

## 7. 一张简化心智图

可以把整条链路理解成：

1. 节点定义 outputs schema。
2. 聚合器只收“当前节点之前、当前上下文可见”的变量。
3. UI 把聚合结果展示成 picker、prompt block、条件选择器。
4. 用户选中后，保存的是 selector，不是直接保存变量值。
5. 运行时节点完成执行后，把 outputs 写入 variable pool。
6. 下游节点按 selector 从 variable pool 读取。

## 8. 针对当前 LLM 节点的结论

你看到的这两个：

- `text`
- `reasoning_content`

之所以能被后续 workflow 节点作为可选变量，真正原因不是 `panel.tsx` 里这两个 `VarItem` 本身，而是：

- 前端聚合的真实定义来自 `LLM_OUTPUT_STRUCT`
- 下游变量选择器使用的是 `toNodeAvailableVars(...)` 聚合结果
- 后端在节点运行成功后把 `outputs.text`、`outputs.reasoning_content` 写进 variable pool

`panel.tsx` 只是把这两个字段可视化展示给编辑者看。

如果未来你们要做变量体系重构，最值得统一的地方是：

- 避免“面板展示定义”和“变量系统定义”双写
- 尽量让节点输出 schema 只有一份 source of truth，再从它派生 UI 展示与 picker 数据
