# LangGraph 集成说明（后端）

本项目已接入 LangGraph React Agent 作为可选工作流引擎，默认保持原有 LangChain ReAct 流；通过环境开关一键启用/回退。未来可在此基础上扩展循环、分支、并行与更丰富的事件流。

## 开关与安装
- **依赖**：`@langchain/langgraph` 已加入 `apps/server/package.json`。运行 `pnpm install --filter @kronos/server`（或在仓库根执行 `pnpm install`）。
- **环境变量**：`LANGGRAPH_ENABLED`（默认 false）。
  - `true`：`streamChat` 使用 LangGraph 流。
  - `false`：保持原 LangChain ReAct 流。

## 流程入口（SSE 不变）
- 入口：`streamChat`（`apps/server/src/services/streamService.ts`）。
- 选择器：依据 `env.LANGGRAPH_ENABLED` 在 `streamLangGraphReply` / `streamLangChainReply` 之间切换，SSE payload 与前端 `timelineEvents` 协议兼容。

## LangGraph 适配层
- 文件：`apps/server/src/services/langgraphWorkflowService.ts`。
- 核心：`streamLangGraphReply` 使用 `createReactAgent({ llm: chatModel, tools: Object.values(toolRegistry) })`，复用现有工具注册表与模型配置。
- 行为：
  - 根据历史 + memory summary 组装初始 `messages`，流式读取最新 AI 消息文本增量并产出 `content` 事件。
  - 目前 timeline 仅输出简单的 plan/reason 起止提示；后续可在此处加入节点/循环/工具级别的事件映射。

## 扩展指引
- **自定义图**：替换 `createReactAgent` 为自定义 LangGraph 图（支持分支/循环/并行/Router）。建议在本文件新增工厂函数并透出配置项（如最大步数、checkpoint 存储）。
- **工具/插件**：继续向 `toolRegistry` 注册工具，即可被 LangGraph 复用；若需远程加载，考虑在此处引入动态注册逻辑。
- **事件映射**：LangGraph 的运行事件可转换为现有 `TimelineEvent`，并增加 `nodeId/loop/step` 字段（前端 `ToolInvocationPanel` 可直接展示）。
- **容错**：LangGraph 支持 checkpoint/重试；当前骨架未开启持久化，后续可接 Redis/DB 以实现中断恢复。

## 已知限制 / TODO
- JS 版 LangGraph 生态与文档仍在演进，某些 Python 特性（丰富的存储适配器、可视化工具链）暂缺。
- 事件粒度目前较粗（仅 plan/reason），需要二次映射 LangGraph run events 才能完整呈现 DAG/循环轨迹。
- 未引入 checkpoint 存储；长流程/并发场景建议补全。
