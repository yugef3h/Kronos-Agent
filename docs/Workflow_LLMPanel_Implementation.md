# Workflow LLMPanel Implementation

## 当前状态落点

Kronos 当前版本的 LLMPanel 采用两层状态：

1. ReactFlow 节点内存层：配置实时写入 `node.data.inputs`。
2. 应用持久化层：`draft-page` 会把当前 `nodes/edges` 同步回 `apps/web/src/features/workflow/workflowAppStore.ts` 的 `dsl`，因此刷新后可恢复。

这与复刻说明里的 Dify 分层不完全一致，但已经具备本项目需要的“可编辑 + 可回填 + 可持久化”最小闭环。

## 当前已实现能力

1. 模型选择与 completion params 基础编辑。
2. chat / completion 两种 prompt 结构切换。
3. 当前版本仅保留纯文本 prompt 编辑。
4. Context 变量选择与“已启用但未插入 context block”提醒。
5. Memory 开关、窗口大小、query prompt、completion 模式 role prefix。
6. Vision 开关、文件变量选择、分辨率设置，并根据模型能力自动修正。
7. Reasoning Format 切换。
8. Structured Output 开关与 JSON Schema 文本编辑。
9. 固定输出变量展示。
10. 模型切换时清洗不兼容 completion params。

## 2026-04 交互更新

1. 模型入口改为固定虚拟模型“智灵”，前端不再暴露真实 provider / model name，实际接入模型由后端决定。
2. LLM 参数区改为通用滑块 + 数字输入组件，当前覆盖 `temperature`、`topP`、`topK`、`maxTokens`。
3. Prompt 角色和 Vision 分辨率切换改为统一的自定义单选组，避免继续使用系统原生样式。
4. 记忆窗口大小也复用同一套数字滑块组件，后续新增数字参数时直接补 catalog 元数据即可。

## 当前工程约束

1. 模型能力和模型列表目前是前端静态 catalog，不是后端动态查询。
2. 可用变量树目前是轻量实现：系统变量 + 其他节点 outputs，不包含真实的分支可达性分析。
3. Prompt generator、拖拽排序、system 唯一限制、调试缓存失效处理还未接入。
4. Structured Output 暂时采用 JSON 文本编辑，不是可视化 schema tree editor。

## 后续建议

1. 抽离 `useAvailableWorkflowVariables`，按上游可达节点与变量类型做真正过滤。
2. 将模型 catalog 与 feature 查询移动到服务层，避免前端静态常量漂移。
3. 为 `useLLMPanelConfig` 再补一层纯迁移函数测试，覆盖模型切换和 memory/vision 联动。
4. 如果后续引入后端 DSL，同步策略应从 localStorage store 迁移为“ReactFlow 内存 + draft API”双写。