# AI Service 高并发落地计划

> 对照 [AI_Service.md](../local_docs/docs/AI_Service.md) · 细粒度 feat · **每项完成：`git add` + `git commit` + `pnpm --filter @kronos/server lint`（或 test）**  
> 原则：先 type / 单函数 / 通用函数，再接线；不堆未提交代码。

## 进度

| 域 | 计划 | 已完成 |
|----|------|--------|
| 1 网关调度 | 12 | 12 |
| 2 削峰排队 | 11 | 11 |
| 3 缓存复用 | 11 | 11 |
| 4 模型弹性 | 10 | 10 |
| 5 熔断降级 | 11 | 11 |
| 6 RAG 高并发 | 11 | 11 |
| 7 资源成本 | 11 | 11 |
| **Phase 2 生产闭环** | **18** | **18** |
| **Phase 3 深化集成** | **13** | **13** |
| **合计** | **108** | **108** |

> Phase 1（77 项）骨架与接线已完成；Phase 2 补齐 **异步 Worker、任务 SSE、网关动态模型、会话槽释放、降级策略生效**。  
> Phase 3：**invokeGateway 接入线性规划/推理流、model_result 读缓存、Redis 任务持久化、Token 预算限流、健康检查**。

---

## Phase 3：深化集成（13）

| ID | 粒度 | 交付物 | 状态 |
|----|------|--------|------|
| P3-G-01 | fn | `buildPlaygroundGatewayContext` 统一构造网关上下文 | ✅ |
| P3-G-02 | fn | `invokeGatewayLlm` 任意 ChatOpenAI + 熔断重试 | ✅ |
| P3-G-03 | fn | `streamGatewayLlm` 流式推理 + 熔断记账 | ✅ |
| P3-G-04 | wire | `linearChatStream` 规划阶段走 `invokeGatewayLlm` | ✅ |
| P3-G-05 | wire | `linearChatStream` 推理阶段走 `streamGatewayLlm` | ✅ |
| P3-C-01 | wire | `streamChat` 先查 `model_result` 再查 `prompt` 缓存 | ✅ |
| P3-Q-01 | type | `AiTaskStore` 接口（create/get/patch） | ✅ |
| P3-Q-02 | fn | `getAiTaskStore` memory / redis 选择 | ✅ |
| P3-Q-03 | store | `redisAiTaskStore` 任务 JSON 持久化 | ✅ |
| P3-Q-04 | wire | 任务路由与 `runChatAiTask` 改走 `getAiTaskStore` | ✅ |
| P3-T-01 | fn | `checkTokenBudgetRateLimit` 用户日 Token 预算 | ✅ |
| P3-T-02 | wire | `aiRateLimitMiddleware` 接入 token_budget 检查 | ✅ |
| P3-A-01 | route | `GET /api/ai/health` 队列/熔断/缓存状态 | ✅ |

---

## Phase 2：生产闭环（18）

| ID | 粒度 | 交付物 | 状态 |
|----|------|--------|------|
| P2-Q-01 | fn | `appendAiTaskEvent` / `listAiTaskEvents` 任务事件内存表 | ✅ |
| P2-Q-02 | fn | `runChatAiTask`：消费 chat 任务并写 result + events | ✅ |
| P2-Q-03 | fn | `startAiTaskWorker`：BullMQ Worker 绑定 `runChatAiTask` | ✅ |
| P2-Q-04 | wire | `index.ts` 在 `AI_TASK_QUEUE_ENABLED` 时启动 Worker | ✅ |
| P2-Q-05 | wire | 队列关闭时 `202` 后 `void runChatAiTask` 进程内执行 | ✅ |
| P2-Q-06 | route | `GET /api/ai/tasks/:id/events` SSE 推送任务进度 | ✅ |
| P2-G-01 | fn | `getPlaygroundChatModel(ctx, opts)` 按请求解析网关模型 | ✅ |
| P2-G-02 | wire | `langGraphChatStream` 每轮用 `getPlaygroundChatModel` | ✅ |
| P2-G-03 | wire | `linearChatStream` 每轮用 `getPlaygroundChatModel` | ✅ |
| P2-G-04 | wire | `agentStreamRouter` 透传 `userId` / `sessionId` | ✅ |
| P2-F-01 | wire | `resolveDegradePolicy` → LangGraph `recursionLimit` | ✅ |
| P2-T-01 | middleware | `releaseConcurrentSessionSlot` 在响应结束时释放槽位 | ✅ |
| P2-T-02 | wire | `chat-stream` 挂载释放中间件 | ✅ |
| P2-C-01 | fn | `buildModelResultCacheKey` + 可选写入 model_result 层 | ✅ |
| P2-E-01 | env | `env.ts` 增加 `AI_TASK_QUEUE_ENABLED` / `AI_LOAD_PERCENT` | ✅ |
| P2-E-02 | doc | `apps/.env.example` Phase 2 变量说明 | ✅ |
| P2-T-03 | test | `runChatAiTask` 单测（mock agent stream） | ✅ |
| P2-D-01 | doc | README 增加 AI 高并发开关说明一节 | ✅ |

---

## 目录约定（新增代码根）

```text
apps/server/src/ai/
  types/           # 纯类型
  gateway/         # 模型路由、统一调用
  rateLimit/       # 限流
  cache/           # 缓存键与读写
  queue/           # 任务优先级、作业元数据
  circuit/         # 熔断、降级
  rag/             # 检索缓存、预热
  cost/            # Token 计量、并发会话
  middleware/      # Express 中间件
```

---

## 1. 流量接入 & 网关调度（12）

| ID | 粒度 | 交付物 | 状态 |
|----|------|--------|------|
| G-01 | type | `ModelProviderId`：`'doubao' \| 'openai' \| 'qwen' \| 'wenxin' \| 'spark' \| 'local'` | ✅ |
| G-02 | type | `ModelRouteIntent`：`'chat' \| 'embedding' \| 'vision' \| 'planning'` | ✅ |
| G-03 | type | `GatewayModelConfig`：provider、model、baseUrl、priority、maxConcurrency | ✅ |
| G-04 | type | `GatewayRequestContext`：userId、sessionId、intent、traceId | ✅ |
| G-05 | fn | `parseGatewayModelConfigs(env)`：从 `AI_GATEWAY_MODELS` JSON 解析配置列表 | ✅ |
| G-06 | fn | `selectGatewayModel(ctx, configs)`：按 intent + priority 选可用模型 | ✅ |
| G-07 | fn | `buildOpenAiCompatibleClient(config)`：统一 LangChain ChatOpenAI 构造 | ✅ |
| G-08 | fn | `resolveDefaultGatewayModel(intent)`：未配置时回退 `DOUBAO_*` | ✅ |
| G-09 | fn | `createGatewayInvokeHeaders(ctx)`：透传 trace / user 到上游 | ✅ |
| G-10 | middleware | `attachGatewayContext`：JWT sub → `GatewayRequestContext` | ✅ |
| G-11 | wire | `langchainChatService` 经 gateway 取 model（保持 mock 路径） | ✅ |
| G-12 | wire | `llmNodeDebugExecutor` 经 gateway 取 model | ✅ |

---

## 2. 请求削峰 & 异步排队（11）

| ID | 粒度 | 交付物 | 状态 |
|----|------|--------|------|
| Q-01 | type | `AiTaskKind`：`'chat' \| 'workflow_draft' \| 'image' \| 'embedding_batch'` | ✅ |
| Q-02 | type | `AiTaskStatus`：`'queued' \| 'running' \| 'succeeded' \| 'failed' \| 'cancelled'` | ✅ |
| Q-03 | type | `AiTaskRecord`：taskId、kind、priority、payload、status、progress | ✅ |
| Q-04 | type | `AiTaskPriority`：0–9 数值，付费用户加权常量 | ✅ |
| Q-05 | fn | `computeTaskPriority(ctx)`：user tier + kind → priority | ✅ |
| Q-06 | fn | `buildAiTaskJobId(kind, id)`：BullMQ jobId 规范化 | ✅ |
| Q-07 | fn | `shouldEnqueueChatTask(promptChars)`：超长 prompt 走异步阈值 | ✅ |
| Q-08 | store | `memoryAiTaskStore`：create/get/patch 内存任务表 | ✅ |
| Q-09 | fn | `enqueueAiTask(record)`：复用 Redis + BullMQ（与 workflow 队列并列） | ✅ |
| Q-10 | route | `POST /api/ai/tasks` 创建任务、`GET /api/ai/tasks/:id` 轮询 | ✅ |
| Q-11 | wire | chat-stream 超阈值返回 `202` + taskId，SSE 改拉 task events | ✅ |

---

## 3. 缓存复用（11）

| ID | 粒度 | 交付物 | 状态 |
|----|------|--------|------|
| C-01 | type | `CacheLayer`：`'prompt' \| 'retrieval' \| 'model_result'` | ✅ |
| C-02 | type | `CacheEntry<T>`：key、value、expiresAt、hitCount | ✅ |
| C-03 | fn | `hashCacheKey(layer, parts)`：sha256 稳定键 | ✅ |
| C-04 | fn | `buildPromptCacheKey(prompt, model, temperature)` | ✅ |
| C-05 | fn | `buildRetrievalCacheKey(query, datasetIds, topK)` | ✅ |
| C-06 | store | `memoryCacheStore`：get/set/delete + TTL | ✅ |
| C-07 | store | `redisCacheStore`：可选 Redis 实现（`AI_CACHE_REDIS=1`） | ✅ |
| C-08 | fn | `getCacheStore()`：按 env 选 memory/redis | ✅ |
| C-09 | fn | `evictExpiredEntries(store)`：冷热清理入口 | ✅ |
| C-10 | wire | `runKnowledgeRetrievalQuery` 读/写 retrieval 缓存 | ✅ |
| C-11 | wire | chat-stream 命中 prompt 缓存直接 SSE 回放 | ✅ |

---

## 4. 模型弹性 & 混合部署（10）

| ID | 粒度 | 交付物 | 状态 |
|----|------|--------|------|
| M-01 | type | `ModelTier`：`'small' \| 'large' \| 'local'` | ✅ |
| M-02 | type | `ModelRouteRule`：maxPromptTokens、intent、tier | ✅ |
| M-03 | fn | `estimatePromptTier(tokenCount)`：简单/复杂分流 | ✅ |
| M-04 | fn | `pickModelTierByTokens(tokens, rules)` | ✅ |
| M-05 | fn | `filterConfigsByTier(configs, tier)` | ✅ |
| M-06 | fn | `mergeBatchPrompts(items, maxChars)`：短请求合并占位 | ✅ |
| M-07 | fn | `splitBatchResults(raw)`：批量响应拆条 | ✅ |
| M-08 | env | `AI_LOCAL_MODEL_BASE_URL` 本地 OpenAI 兼容端点 | ✅ |
| M-09 | wire | gateway `selectGatewayModel` 接入 tier 规则 | ✅ |
| M-10 | test | tier 分流单测（<500 token → small） | ✅ |

---

## 5. 熔断降级 & 故障自愈（11）

| ID | 粒度 | 交付物 | 状态 |
|----|------|--------|------|
| F-01 | type | `CircuitState`：`'closed' \| 'open' \| 'half_open'` | ✅ |
| F-02 | type | `CircuitBreakerConfig`：failureThreshold、openMs、halfOpenProbe | ✅ |
| F-03 | fn | `createCircuitBreaker(name, config)`：内存状态机 | ✅ |
| F-04 | fn | `recordCircuitSuccess(name)` / `recordCircuitFailure(name)` | ✅ |
| F-05 | fn | `isCircuitOpen(name)` | ✅ |
| F-06 | fn | `selectFallbackModel(primary, configs)`：主模型 open 时切备 | ✅ |
| F-07 | type | `DegradePolicy`：disableCoT、maxToolSteps、maxOutputTokens | ✅ |
| F-08 | fn | `resolveDegradePolicy(loadPercent)`：高峰降级策略 | ✅ |
| F-09 | fn | `invokeWithRetry(fn, { maxAttempts, backoffMs })` | ✅ |
| F-10 | fn | `fallbackReplyText(code)`：统一兜底文案表 | ✅ |
| F-11 | wire | gateway 调用包裹 circuit + retry + fallback 文案 | ✅ |

---

## 6. RAG 高并发检索（11）

| ID | 粒度 | 交付物 | 状态 |
|----|------|--------|------|
| R-01 | type | `RetrievalCacheKeyParts`：query、datasetIds、method、topK | ✅ |
| R-02 | fn | `shardDatasetId(datasetId)`：分片键（预留多实例） | ✅ |
| R-03 | fn | `runParallelRetrievalPaths(paths, fn)`：Promise.all 包装 | ✅ |
| R-04 | fn | `scoreKeywordPath(chunks, terms)`：抽离关键词路 | ✅ |
| R-05 | fn | `scoreSemanticPath(chunks, vectors)`：抽离语义路 | ✅ |
| R-06 | fn | `mergeRetrievalPaths(results, weights)`：多路融合 | ✅ |
| R-07 | fn | `warmDatasetChunks(datasetId)`：预热加载 chunks 入内存 LRU | ✅ |
| R-08 | store | `chunkWarmCache`：datasetId → chunks 条目 + TTL | ✅ |
| R-09 | fn | `getCachedRetrieval(key)` / `setCachedRetrieval(key, items)` | ✅ |
| R-10 | wire | `knowledgeRetrievalService` 并行路径 + 检索缓存 | ✅ |
| R-11 | route | `POST /api/knowledge/datasets/:id/warm` 管理预热 | ✅ |

---

## 7. 资源管控 & 成本（11）

| ID | 粒度 | 交付物 | 状态 |
|----|------|--------|------|
| T-01 | type | `RateLimitScope`：`'user' \| 'session' \| 'token_budget' \| 'concurrent_session'` | ✅ |
| T-02 | type | `RateLimitResult`：allowed、remaining、retryAfterMs | ✅ |
| T-03 | fn | `createTokenBucket(key, capacity, refillPerSec)` | ✅ |
| T-04 | fn | `consumeTokenBucket(bucket, cost)` | ✅ |
| T-05 | fn | `checkUserRateLimit(userId, scope)` | ✅ |
| T-06 | fn | `checkSessionRateLimit(sessionId)` | ✅ |
| T-07 | fn | `acquireConcurrentSessionSlot(userId, max)` / `release` | ✅ |
| T-08 | fn | `recordTokenUsage(userId, { input, output, model })` | ✅ |
| T-09 | fn | `isOverGlobalTokenQuota()`：日配额熔断 | ✅ |
| T-10 | middleware | `aiRateLimitMiddleware`：chat-stream / ai/tasks 入口 | ✅ |
| T-11 | wire | 超限返回 429 + `Retry-After`，记 usage 到 memory/redis | ✅ |

---

## 执行顺序（推荐）

```mermaid
flowchart LR
  types[1 types 全域] --> limit[7 限流基础]
  limit --> cache[3 缓存键]
  cache --> gateway[1 网关]
  gateway --> circuit[5 熔断]
  circuit --> rag[6 RAG]
  rag --> queue[2 队列]
  queue --> wire[各 wire]
```

1. **批次 A**：G-01～G-04、T-01～T-02、C-01～C-02、Q-01～Q-02、F-01～F-02、R-01、M-01（纯 type，约 12 commit）
2. **批次 B**：哈希/限流/熔断/缓存单函数（约 20 commit）
3. **批次 C**：store + middleware（约 10 commit）
4. **批次 D**：wire 现有 chat / RAG / workflow（约 15 commit）

---

## Commit 模板

```bash
git add -A && git commit -m "feat(server): <ID> <简短说明>"
pnpm --filter @kronos/server lint
```

---

## 变更日志

| 日期 | Commit | ID |
|------|--------|-----|
| 2026-05-21 | `5d1cd21` | PLAN |
| 2026-05-21 | `82f601f`…`784f3d3` | 批次 A |
| 2026-05-21 | `2534639`…`b972b10` | 批次 B/C/D（C/F/Q/T/G wire） |
| 2026-05-21 | `628de97`…`3e2a406` | 批次 M/R 全部完成 |
| 2026-05-21 | — | **77/77 完成** |
| 2026-05-21 | `abaf1a6`… | Phase 2 共 18 项（小步 commit） |
| 2026-05-21 | — | **95/95 完成** |
| 2026-05-21 | `7f8b4fd`…`38f3874` | Phase 3 共 13 项 |
| 2026-05-21 | — | **108/108 完成** |
