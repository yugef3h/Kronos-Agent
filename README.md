# Kronos Agent

探索 LLM 原理与 Agent Workflow 的前端主导项目，目标是让前端工程师能用可视化手段掌握并落地 AI Agent 系统（对标 Dify 类平台的产品形态）。

---


### 对话上下文如何拼装（Playground）

每轮 `POST /api/chat-stream` 前，服务端 `createMemoryPlan`（`apps/server/src/memory/`）在**不二次调模型做摘要**的前提下：

1. 从 `sessionStore` 取全量消息；条数 ≥ 12 时把较早对话压进 **滚动摘要** `memorySummary`；
2. 按 token 预算（约 32k 窗口 × 60% 输入预算 − 预留输出）从最近 8 条里**反选**能塞进模型的 history；
3. 若首页选了假发布 Chatbot，再叠加 **Workflow 编排**（系统提示、变量）与 **RAG 检索片段**（有 `dataset_ids` 时）。

前端 `MemorySummaryPanel` / `playgroundStore.memoryMetrics` 展示摘要与估算 token，便于对照「模型实际看到什么」。

### 编排与运行分别记在哪

| 类型 | 内容 | 存储 |
| --- | --- | --- |
| **编排稿** | 节点 DSL、Chatbot prompt、检查清单依赖的配置 | 自建：`localStorage` `kronos_workflow_apps_v1`；内置示例：服务端 `workflow-examples/`（只读）+ 可选 `kronos_workflow_example_mock_publish_v1` 覆盖假发布 |
| **编排元数据** | 列表缩略图、草稿更新时间 | `kronos_workflow_draft_preview_v1:{appId}`；可选同步 `workflow-draft-previews/` |
| **运行痕迹** | 单节点调试 I/O、整图 draft-run 事件 | API 写入 `workflowRunStore`；SSE 回写画布 `_runStatus` / `_lastRun`（刷新画布仍在，换机不在） |

### 浏览器 localStorage 键（Workflow 相关）

| 键 | 用途 |
| --- | --- |
| `kronos_workflow_apps_v1` | 自建应用 DSL、`mockPublished` |
| `kronos_workflow_draft_preview_v1:{appId}` | 列表缩略图（与主 JSON 分离，避免配额撑爆） |
| `kronos_workflow_example_mock_publish_v1` | 只读内置示例的假发布（不写服务端示例 JSON） |

---

## Workflow 编排与调试

路由：`/workflow` 列表 → `/workflow/draft?appId=` 画布 → `/workflow/config?appId=` Chatbot 配置。

### 测试运行（整图）

- 顶部 **「测试运行」**：不再弹模态框；检查清单不通过时打开首个问题节点的 Panel 并展示 blocker。
- 校验通过：第一次打开 **开始节点** 的「上次运行」Tab 填写输入；再次点击同一触发节点上的「测试运行」执行 `draft-runs`（SSE）。
- 开始节点通过 `WorkflowDraftTestRunProvider` 注册 `getDraftRunInputs`。

### 单节点调试

- 画布节点 **▶**：先校验 → 失败则打开 Panel（设置 Tab + blocker）；通过则切到「上次运行」并调用 `POST /api/workflow/debug/node`。
- Panel **「运行调试」**：Start / LLM / End / IfElse / 知识检索等面板；异步请求期间 **转圈 +「调试中…」**（`PanelRunDebugButton`）。
- Start 节点：调试表单必填与 JSON/数字格式校验，字段下红色 inline 错误；成功后「上次运行」展示输入/输出。
- 鉴权：调试与 draft-run 请求统一走 `buildWorkflowAuthHeaders`（与知识库 dev token 一致）。

### 发布（本地）

- 草稿页工具栏：**测试运行 | 发布 | 检查清单**（`WorkflowMockPublishButton`）。
- 自建应用：写入 `kronos_workflow_apps_v1` 的 `mockPublished`；列表显示绿色已发布勾。
- **只读内置示例**：画布 DSL 仍只读，但允许假发布；状态写入 `kronos_workflow_example_mock_publish_v1`。
- Chatbot 配置页复用同一发布按钮；Playground 可选已假发布的 Chat 应用走 RAG 增强（见 `publishedChatbotPlaygroundPrompt`）。

### 只读示例

- `GET /api/workflow/examples` 加载内置 DSL；画布锁定编辑，支持查看、测试运行、单节点调试、假发布标记。

主要前端目录：`apps/web/src/domains/workflow/editor/`（`draft-page/`、`compts/`、`hooks/use-node-debug-run.ts`）。

---

## 知识库与 RAG

面向产品的能力如下；**自研检索与 LangChain 检索视为同一产品能力**：由服务端 `RAG_ENGINE_MODE` 切换实现路径，**同一套 REST 契约与工作流配置页**，前端 `/rag` 与编排侧无分支 UI。

| 能力 | 说明 |
| --- | --- |
| **入口** | 前端 [`/rag`](http://localhost:5173/rag)（壳导航「知识库」）：数据集 CRUD、按库导入、文档列表、Chunk 浏览与块级 **关键词** 编辑。 |
| **文档与切片** | 上传/拖拽与批量导入、预处理规则、分段长度与重叠；导入前 **切片预估预览**。 |
| **检索** | 多库、Top K、阈值、元数据过滤、混合检索；可选 **多问句改写**（`RAG_LC_MULTI_QUERY`）。 |
| **工作流侧** | 知识检索节点、Chatbot `config-page` 与 `chatbot-prompt-editor`。 |
| **健康度与快照** | `GET …/health`、数据集快照 API。 |
| **对比与评测** | compare / evaluate API（前端 `features/rag/api`）。 |

### 产品界面

| 场景 | 截图 |
| --- | --- |
| **知识库导入与分块预览** | 导入弹窗内配置分段（标识符、最大长度、重叠、预处理）与右侧块级预览，对应切片预估与入库前校验。 |
| **工作流 · 知识检索节点** | 画布上多库知识检索 → LLM → 输出；侧栏配置查询变量、已选知识库与召回参数。 |
| **Chatbot 编排与调试** | `/workflow/config`：提示词、变量、多库召回（Top K / Rerank）、视觉开关；右侧「调试与预览」对话。 |
| **Playground 选用 RAG 应用** | 首页底部选择或创建知识库 / 已假发布的 RAG Chatbot，发送后走检索增强链路。 |
| **节点上次运行** | Panel「上次运行」展示 SUCCESS、耗时与 JSON 输入/输出（含 `sys.*` 系统字段）。 |

![知识库导入：分段参数与块预览](./static/截屏2026-03-18%2023.49.41.png)

![工作流画布：知识检索节点配置](./static/截屏2026-03-18%2023.50.12.png)

![RAG Chatbot：编排与调试预览](./static/截屏2026-03-18%2023.55.57.png)

![Playground：选择 RAG 应用](./static/截屏2026-03-18%2023.57.39.png)

---

## Playground 对话

- 路由 `/`：SSE 流式对话、采样/注意力/Token 可视化占位。
- 已选 **假发布 Chatbot** 时跳过外卖编排短路，走知识库检索 + 增强 prompt（与编排页「与 Bot 聊天」一致）。
- 路由与优先级见 [`PLAYGROUND_QUERY_ROUTING.md`](apps/web/src/features/chat-stream/components/PLAYGROUND_QUERY_ROUTING.md)。

---

## 目录结构

```text
apps/
  web/                # 前端：Playground、/rag、domains/workflow 编排
  server/             # 后端：chat-stream、memory、workflow debug/draft-runs、RAG
  server_py/          # Python 后端（memory 等镜像实现）
packages/
  core/               # 共享领域层


DEBRIED_ISSUES.md     # 问题复盘记录
```

## 快速启动

```bash
pnpm install
pnpm dev
```

复制 `apps/.env.example` 为 `apps/.env`，填写 JWT 与豆包模型参数。

## MVP 对应能力

| 域 | 能力 |
| --- | --- |
| **对话** | SSE Chat、服务端会话落盘、滚动摘要与 token 预算、Playground 记忆面板 |
| **知识库** | 数据集 CRUD、检索、工作流知识节点、Chatbot RAG 拼接 |
| **编排** | Workflow 列表/草稿/Chatbot 配置、DSL 自动保存、缩略图、内置示例、假发布 |
| **运行** | 单节点调试 API、整图 draft-run SSE、画布运行态与「上次运行」 |

## AI 高并发开关（`apps/server/src/ai`）

| 变量 | 说明 |
| --- | --- |
| `AI_GATEWAY_MODELS` | 多模型 JSON，Playground/调试经网关选型 |
| `AI_CHAT_ASYNC_ENABLED` | 超长 Prompt（默认 ≥12000 字）走 `202` + `/api/ai/tasks/:id/events`；前端超长时先 `fetch` 再接任务 SSE |
| `AI_CHAT_ASYNC_THRESHOLD_CHARS` | 异步阈值字符数（默认 `12000`） |
| `AI_TASK_EVENTS_REDIS` | 任务事件 SSE 走 Redis（可与 `AI_TASK_STORE_REDIS` 同开） |
| `AI_TASK_QUEUE_ENABLED` | 需 `REDIS_URL`，BullMQ 消费 chat 任务 |
| `AI_CACHE_REDIS` | 缓存走 Redis |
| `AI_LOAD_PERCENT` | 0–100，高峰时收紧 LangGraph `recursionLimit` |
| `AI_MAX_CONCURRENT_SESSIONS_PER_USER` | 单用户并发会话槽 |
| `AI_TASK_STORE_REDIS` | 任务状态持久化到 Redis |
| `AI_USER_TOKEN_BUDGET_PER_DAY` | 单用户日 Token 上限 |

健康检查：`GET /api/ai/health`。详见 [docs/AI_SERVICE_IMPLEMENTATION_PLAN.md](docs/AI_SERVICE_IMPLEMENTATION_PLAN.md)。

## 安全与模型接入

- API 路由统一 JWT Bearer；Workflow 调试与 draft-run 与 Playground 共用鉴权头构建逻辑。
- LangChain.js 经 OpenAI 兼容接口接豆包；未配置时 mock stream 便于 UI 调试。
- Token/Embedding：`POST /api/token-embedding/analyze`；识图：`POST /api/image/analyze`。

## Apache 2.0 合规声明模板（已启用）

本项目采用 Apache License 2.0：

- `LICENSE` · `NOTICE` · 源码文件 `SPDX-License-Identifier: Apache-2.0`

### 维护建议

- 引入外部代码时保留原始版权与许可证声明。
- 对已修改的第三方文件，在文件内标注变更说明与日期。
