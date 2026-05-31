# Kronos-Agent 待办清单

> 来源：web + server 代码梳理（2026-05）+ `local_docs/docs` 内部 md 检索（2026-05-30）。已完成项标注 ✅。

---

## 已完成

| 项 | 说明 |
|----|------|
| ✅ Zustand 全量订阅 | `useChatStreamController` 及侧边栏改为 selector / `useShallow` |
| ✅ 打字机批量 flush | 32ms/字 → 80ms/批，长回复 `setMessages` 次数大减 |
| ✅ god hook 拆分 | 拆为 session / memory / history / hotTopics / chatStream 子 hooks |
| ✅ `useChatStreamController` 瘦身 | ~1467 → ~685 行；拆出 sendPrompt / RAG / media / panelUi / history / takeoutQuickAction |
| ✅ 路由懒加载 | workflow draft/config、rag 等 `lazy()` + `RouteLoading` |
| ✅ Vite 分包 | `reactflow`、`echarts`、`d3` 独立 chunk |
| ✅ Session 双重 hydrate | 合并为单 effect（`authToken + sessionId + !hasRestorableDraft`） |
| ✅ SSE `JSON.parse` 保护 | `usePlaygroundChatStream` fetchEventSource 路径加 try/catch |
| ✅ unmount timer 清理 | `useChatStreamController` + 子 hooks | cleanup 读 ref.current，清除全部 timer |
| ✅ 消息 list 稳定 key | `clientMessageId` + `getMessageListKey` | 新建消息自动分配 id |
| ✅ P0 鉴权收紧（部分） | `middleware/maybeSkipAuth.ts` | prod 关闭 user `draft-preview` skip；`workflow/examples` 仅 GET 公开；PUT/DELETE 需 JWT；Node + Python 对齐 |
| ✅ attachments 签名 URL | `attachmentSignedUrl.ts` | HMAC(`JWT_SECRET`) + exp/sig query；handler 验签；session snapshot 注入 `accessUrl` |

---

## 前端 — 性能优化（待处理）

### P1

| 项 | 位置 | 说明 |
|----|------|------|
| 消息列表虚拟化 | `ChatStreamPanelView.tsx` | 长会话全量渲染 `StreamingMarkdownMessage`，滚动/DOM 压力大 |

### P2

| 项 | 位置 | 说明 |
|----|------|------|
| 首页 markdown/highlight 前置加载 | `main.tsx` | 可考虑按需加载 highlight 样式 |
| RagPage 上帝组件拆分 | `pages/rag/RagPage.tsx` | Refactor_RAG：1000+ 行；拆 `useRag*` hooks + 导入/详情弹窗 lazy |

---

## 前端 — 隐患 / Bug（待处理）

### 高

| 项 | 位置 | 说明 |
|----|------|------|
| 生产仍依赖 dev token | `useChatStreamController`、`workflowAuth.ts`、`dataset-store.ts` | 见「httpOnly Cookie + 短时效 JWT」；迁移完成前：`isViteDev()` 才自动 `requestDevToken` |
| 未处理 409 冲突 | `usePlaygroundChatStream.ts` / chat 发送链路 | 后端 `SESSION_STREAM_BUSY`、`SESSION_VERSION_CONFLICT` 无专门 UI |
| Workflow 本地存储为真相源 | `workflowAppStore.ts` | RAG 配置读 localStorage，多设备/清缓存后与 server 不一致 |

### 中

| 项 | 位置 | 说明 |
|----|------|------|
| LLM 模型 catalog 前端静态 | `llm-panel` catalog | Workflow_LLMPanel：能力/列表非后端动态，易与真实模型漂移 |
| LLM 变量树无分支可达性 | panel 变量选择器 | 仅系统变量 + 其他节点 outputs，无 IfElse 分支过滤 |
| 外卖业务真值在前端 mock | `takeout/data/mockData.ts` | TAKEOUT Phase 4：MOCK_FOODS/ADDRESS 仍作展示兜底，未迁后端快照 |
| Workflow 运行态混 DSL | `node.data._*` | workflow-run-spec：`_runningStatus` 等运行字段与 DSL 同存，草稿可能带脏 runtime |
| Workflow 容器子图运行态不完整 | iteration / loop | ITERATION-LOOP：缺 LoopEnd/IterationEnd、并行 tracing 分桶（`iterParallelLogMap` 等价物） |
| 未发 `last-event-id` | SSE 消费层 | 后端支持断点续传，前端重连会丢事件 |
| 图片上传无法取消 | `useChatStreamController.ts` | 清除 `pendingImage` 不 abort 进行中的 `uploadImageToImgbb`，晚到结果可能误写 |
| API 边界无运行时校验 | `lib/api.ts` | 大量 `as Type` 断言，zod 已装未用于 fetch 响应 |
| 错误处理不一致 | 多处 | `readApiErrorMessage` vs 泛化 `'Failed to request…'`；部分 `catch {}` 静默吞错 |
| 429 限流无重试 | chat 发送链路 | 后端返回 `Retry-After`，前端直接失败 |
| `fetchEventSource` 与 fetch 双路径 | `usePlaygroundChatStream.ts` | 可统一为 fetch-first + 同一 SSE 解析器，降低维护成本 |

### 低

| 项 | 位置 | 说明 |
|----|------|------|
| Auth token 重复请求 | `generateDevToken` + `ensureWorkflowAuthToken` | StrictMode 双 mount 可能重复 `requestDevToken` |
| `pollUrl` 未使用 | `ChatAsyncAccepted` 类型 | 仅 `eventsUrl` 被消费 |
| LLM Panel 能力未齐 | `llm-panel` | Prompt generator、拖拽排序、system 唯一限制、调试缓存失效（Workflow_LLMPanel） |
| DSL 导入知识库绑定 | workflow DSL 导入 | DSL导入修正：旧 DSL `dataset_ids` 可能失效，导入后需手动重绑 |

---

## 前端 — RAG 产品缺口（待处理）

> 来源：`RAG_Prod_capability.md` · `Refactor_RAG_with_Langchain.md`

### P1

| 项 | 位置 | 说明 |
|----|------|------|
| 检索调试/对比/评测无 UI | `RagPage` · workflow | `requestKnowledgeRetrievalCompare` / `Evaluate` API 已有，前端未接 |
| Rerank 启发式非 cross-encoder | `applyReranking` | 加权启发式，精排质量有上限 |

### P2

| 项 | 位置 | 说明 |
|----|------|------|
| 无显式 RRF 多路融合 | `knowledgeRetrievalService` | 多库并行后单路径打分，无 Dify 式多路召回融合配置 |
| RAG 治理能力 | 知识库全链路 | URL 抓取、解析失败队列/批量重试 UI、文档状态机、会话→chunk 沉淀 |
| 检索-生成调试台 | chat / workflow | 无单次「召回 + prompt + 截断字节」合成视图；无每路分数条面板 |
| `RAG_LC_MULTI_QUERY` 成本 | `expandRetrievalQueries` | 多问句改写增加 Chat + embed 延迟，缺开关提示/监控 |

---

## 后端 — 性能 / 架构（待处理）

### P0

| 项 | 位置 | 说明 |
|----|------|------|
| **生产无 JWT 签发 / 登录** | 全栈 | 仅有 dev：`GET /api/dev/token`（`NODE_ENV=production` 返回 404）。`authenticateJwt` 验签已有，**签发侧未做**。前端 Playground / RAG / Workflow 仍走 `requestDevToken`，token 存 **Zustand 内存 + Bearer 头**（非 httpOnly Cookie，dev JWT **7d**）。**服务能起，对话/RAG/调试跑不通。** 目标形态见下节「httpOnly Cookie + 短时效」 |
| JWT `sub` 未贯通 | `authenticateJwt.ts` → `attachGatewayContext.ts` | 校验 token 但未写 `request.auth`，`userId` 恒为 `anonymous`，限流/计费失效；与上项一并做 |
| 限流/熔断/并发槽全在内存 | `ai/rateLimit/*`、`circuitBreaker.ts` | 多实例部署前需迁 Redis |

### P1

| 项 | 位置 | 说明 |
|----|------|------|
| Workflow SSE 仅 replay | `workflowDraftRunRoutes` | dump 已有事件后关闭，排队 run 可能拿到空流；前端靠 poll 补偿 |
| 流式 circuit breaker 误记 success | `streamGatewayLlm` | `stream()` 返回即记成功，中途失败不 increment failure |
| file session 无 stream lock | `sessionStreamLock.ts` | `SESSION_STORE=file` 时同 session 并发 chat 可能 version conflict |
| `POST /api/ai/tasks` 队列关闭不执行 | `aiTaskRoutes.ts` | 与 `/chat-stream` 202 路径行为不一致 |

### P2

| 项 | 位置 | 说明 |
|----|------|------|
| Workflow 事件 live 推送 | workflow events | Redis pub/sub 或长轮询替代 dump-and-close |
| file session 进程内 mutex | `sessionStore` | 即使 file 模式也防并发写 |
| `AI_GLOBAL_TOKEN_QUOTA_PER_DAY` 未进 Zod | `env.ts` | 直接读 `process.env`，启动无校验 |
| `AI_CACHE_REDIS` 未正式化 | health route | 多实例 cache 一致性 |
| LangGraph 无 checkpoint | `langgraphWorkflowService` | langgraph_integration：长流程/并发无法中断恢复 |
| LangGraph 事件粒度粗 | timeline / SSE | 未映射 DAG/循环/工具级 run events |
| 跨会话长期记忆 | memory 策略 | Analysis 40% Lag P2：当前仅滚动摘要 + 预算裁剪 |
| 厂商 Prompt Caching 指标 | gateway 遥测 | 未记录 cached_tokens / 前缀命中（Analysis P1） |

---

## 后端 — RAG / 存储（待处理）

> 来源：`rag-file-storage-implementation-guide.md` §16

| 优先级 | 项 | 位置 | 说明 |
|--------|----|------|------|
| P1 | 文件型索引规模化 | `knowledgeDocumentStore` | JSONL 线性扫描；2 万+ chunks 建议 HNSW 文件索引 |
| P1 | 文件写入一致性 | 知识库 data 目录 | 需原子写入 + 单 dataset 串行索引 + 启动索引修复 |
| P2 | 召回 Prompt 污染 | retrieval → LLM | 低分/重复 chunk 去重与上下文硬上限需产品化 |

---

## 后端 — 隐患 / Bug（待处理）

### 高

| 项 | 位置 | 说明 |
|----|------|------|
| 无鉴权读路径（剩余） | `middleware/maybeSkipAuth.ts` | ✅ attachments 已改签名 URL。**仍待做**：prod 用户 draft-preview `<img>` 无 Authorization（P1） |
| 内存状态无法水平扩展 | rate limit、circuit、token usage | 与 Redis session 存储不匹配，多 pod 各自计数 |
| Mock fallback 掩盖失败 | `streamService.ts` | agent 失败后 `streamMockReply`，用户无法区分真假模型输出 |

### 中

| 项 | 位置 | 说明 |
|----|------|------|
| 异步 chat 孤儿消息 | 长 prompt 202 路径 | 先 append user message，task 失败则无 assistant 回复 |
| AI task SSE 120s 超时 | `aiTaskRoutes.ts` | 长生成可能丢尾部事件 |
| 202 后 concurrent slot 立即释放 | `releaseConcurrentSessionOnFinish` | 异步任务继续跑但不再占槽 |
| CORS 允许无 Origin 请求 | `index.ts` | 非浏览器客户端可通过 |

### 低

| 项 | 说明 |
|----|------|
| 前端未发 `last-event-id` | 服务端 resume 能力闲置（见前端项） |
| `last-event-id` workflow 未对齐 | chat 有、workflow events 无 |
| SSE 流式回归用例缺失 | STREAMING_DEDUP：缺「累计片段输入」「重复 eventId 重放」自动化测试 |
| 外卖 SSE schemaVersion | takeout 事件协议 | TAKEOUT 质量门禁：契约测试 + 版本字段未落地 |

---

## 前后端契约缺口

| 能力 | 后端 | 前端 | 状态 |
|------|------|------|------|
| SSE 断点续传 | ✅ `last-event-id` | ❌ 未发送 | 待做 |
| 409 冲突 | ✅ 结构化 error | ❌ 未处理 | 待做 |
| 429 限流 | ✅ `Retry-After` | ❌ 未重试 | 待做 |
| 用户身份限流 | JWT 有 sub | 未影响 middleware | 待做（后端） |
| **生产登录 / JWT 签发** | ❌ 无 login API | ❌ 仅 `requestDevToken` + Bearer | **阻塞上生产**；目标改为 httpOnly Cookie |
| Workflow SSE | replay only | poll 补偿 | 已知限制 |
| 异步阈值 12k | `AI_CHAT_ASYNC_THRESHOLD_CHARS` | `CHAT_ASYNC_THRESHOLD_CHARS` | ✅ 已对齐 |
| RAG 检索对比/评测 | ✅ compare + evaluate API | ❌ 无 UI | 待做（见 RAG 产品缺口） |
| SSE content 语义 | 约定 delta only | 后端已 normalize | 缺接口契约文档（STREAMING_DEDUP） |

---

## 规划 / 未启动（ARCHITECTURE.md）

| 模块 | 目标位置 | 说明 |
|------|----------|------|
| Token & Embedding Debugger | `features/tokenizer` | 草稿规划，未实现 |
| Multi-Agent Comparison | `features/agents` | 草稿规划，未实现 |
| Tool Invocation Debugger | server langchain tools | 草稿规划，未实现 |

---

## 生产鉴权 — httpOnly Cookie + 短时效 JWT（待做）

> 现状：Bearer + 内存 + dev 7d；**未**用 Cookie。可与 attachments 签名 URL 并存（登录态 vs 只读直链）。

### 待实现

| 项 | 位置 | 说明 |
|----|------|------|
| 登录 / 刷新 / 登出 | `POST /api/auth/login` · `refresh` · `logout` | access：**httpOnly** Cookie，短 TTL（建议 15min～1h）；refresh：独立 httpOnly Cookie，长 TTL（如 7d），`Path` 仅 refresh 路由 |
| middleware 读 Cookie | `authenticateJwt.ts` | 优先 `Cookie` 中 access；迁移期可 fallback `Authorization: Bearer` |
| CORS + credentials | `index.ts` · `lib/api.ts` | `credentials: true` + 前端全部 `fetch` / SSE `credentials: 'include'`；生产宜 **同域**（静态 + `/api` 反代） |
| dev 兼容 | `/api/dev/token` | 非 production 可改为 **Set-Cookie** 而非 JSON `{ token }`；前端逐步去掉 `playgroundStore.authToken` 存 JWT 字符串 |
| 部署 | Nginx / 单域 | 同源后 `<img src="/api/...">` 可自动带 Cookie，可替代部分 draft-preview 签名方案 |

### 实现注意点（必做）

1. **避免并发请求同时刷新 Token**  
   前端维护 **单例 refresh 锁**（如 `refreshInFlight: Promise<void> | null`）：401 时只发起 **一次** `POST /api/auth/refresh`，其余请求 `await` 同一 Promise 后重试；禁止每个 failed fetch 各自打 refresh。

2. **区分 Access Token 与 Refresh Token**  
   - access：短时效，随 API Cookie 发送，**不可**用于 refresh 接口。  
   - refresh：仅 `POST /api/auth/refresh` 使用，单独 Cookie 名 / Path。  
   - 后端 refresh **幂等**：同一 refresh token 并发多次刷新应安全（旋转时旧 refresh 作废需一致；或 Redis 记录 jti 防重放）。

3. **JWT 算法强制校验，禁止 `alg: none`**  
   `jwt.verify` 必须显式 `algorithms: ['HS256']`（与签发一致）；拒绝 header 为 `none` / 未在白名单的 alg；sign 时同样写死 `algorithm: 'HS256'`（devToken 已有，middleware 需对齐）。Node + Python 两侧一致。

---

## 建议修复顺序

1. **全栈** httpOnly Cookie 登录（上表 + 三条注意点）；`authenticateJwt` 读 Cookie + 强制 `HS256`
2. **后端** `authenticateJwt` 挂载 `request.auth.sub`
3. **前端** 409/429 用户可见错误 + `last-event-id`
4. **后端** draft-preview 签名 URL 或同源 Cookie（prod 缩略图 `<img>`）
5. **后端** 限流/熔断迁 Redis（多实例前必做）
6. **前端** 长列表虚拟化
7. **RAG** 检索调试 UI + 文件索引规模化（2 万 chunks 前）
8. **Workflow** runtime overlay 与 DSL 分离；容器 tracing 分桶
