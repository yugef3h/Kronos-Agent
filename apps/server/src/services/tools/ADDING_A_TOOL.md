# Playground 新增工具指南（迭代 13）

Playground 对话的工具统一放在 `services/tools/`，由 `playgroundToolRegistry` 注入 **LangGraph（B）** 与 **线性兜底（A）**。新增工具时**不要**改 `streamService` / `ChatStreamPanel`，按下面清单改即可。

> **协作约定**：架构类改动按「一小步 → 你 review → `pnpm cd`」推进；后续新工具也按本文「一次 1～4 个小提交」执行。

---

## 附录：commit `f4da81d` 对应的 12 步（便于按步 review）

当时为一次性落地，合并为 1 个提交；人工 review 可按路径对照：

| 步 | 内容 | 主要路径 |
|----|------|----------|
| 1 | env：`TAVILY_API_KEY`、`LANGGRAPH_ENABLED` 默认 true、`LANGGRAPH_MAX_TOOL_STEPS` | `config/env.ts`, `.env.example` |
| 2 | 依赖 `@tavily/core` | `apps/server/package.json`, `pnpm-lock.yaml` |
| 3 | SSE 事件类型 | `chat/streamEventTypes.ts` |
| 4 | Timeline 工厂 | `chat/timelineEvents.ts` |
| 5 | 模型 + 多模态消息 | `chat/chatModel.ts`, `chat/buildUserHumanMessage.ts`, `chat/safeStringify.ts` |
| 6 | Tavily 工具 + 格式化 | `tools/tavilyWebSearchTool.ts`, `formatTavilyResults.ts` + tests |
| 7 | 注册表 / 入参 / 规划提示 | `tools/buildToolRegistry.ts`, `resolveToolInvokeInput.ts`, `planningSystemHint.ts`, `playgroundToolRegistry.ts`, `types.ts` |
| 8 | 方案 A 线性流 | `linear/linearChatStream.ts` |
| 9 | 方案 B LangGraph 流 | `langgraph/langGraphChatStream.ts` |
| 10 | B 的 tool 时间线 | `langgraph/toolStreamMapper.ts` + test |
| 11 | B 主 + A 兜底 | `agent/agentStreamRouter.ts` + test |
| 12 | 接入 chat-stream | `streamService.ts`；`langchainChatService.ts` / `langgraphWorkflowService.ts` 改为 re-export |

本地按步看 diff 示例：`git show f4da81d -- apps/server/src/services/tools`

---

## 一次只加 1 个工具时的推荐提交节奏

| 顺序 | 改动 | 建议 `pnpm cd` message |
|------|------|-------------------------|
| 1 | `xxxTool.ts` + 单测 | `feat: add <tool_name> playground tool` |
| 2 | `types.ts` + `buildToolRegistry.ts` | `feat: register <tool_name> in tool registry` |
| 3 | `resolveToolInvokeInput.ts`（仅自定义 schema 时） | `feat: normalize invoke input for <tool_name>` |
| 4 | `planningSystemHint.ts`（仅线性 A 需要更好决策时） | `feat: planning hints for <tool_name>` |

B 路径（LangGraph）主要靠工具的 `description` + ReAct 循环；A 路径额外靠 `planningSystemHint`。

---

## 实例：新增 `dataset_retrieval`（知识库检索，示意）

假设第二个工具要从某数据集检索 chunk，API 密钥 `RAG_INTERNAL_TOKEN`（示例）。

### 1. 新建 `datasetRetrievalTool.ts`

```ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const DATASET_RETRIEVAL_TOOL_NAME = 'dataset_retrieval' as const;

export const createDatasetRetrievalTool = (baseUrl: string, authToken: string) =>
  tool(
    async ({ query, datasetId }) => {
      const res = await fetch(`${baseUrl}/api/knowledge-retrieval/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ query, dataset_ids: [datasetId], top_k: 5 }),
      });
      if (!res.ok) throw new Error(`dataset_retrieval failed: ${res.status}`);
      const data = (await res.json()) as { chunks?: Array<{ content?: string }> };
      return (data.chunks ?? []).map((c, i) => `[${i + 1}] ${c.content ?? ''}`).join('\n\n');
    },
    {
      name: DATASET_RETRIEVAL_TOOL_NAME,
      description:
        'Retrieve grounded passages from an internal knowledge dataset. Use when the user asks about uploaded docs, policies, or product manuals—not for live web news.',
      schema: z.object({
        query: z.string().min(1),
        datasetId: z.string().min(1).describe('Target dataset id'),
      }),
    },
  );
```

### 2. 扩展 `types.ts`

```ts
export type PlaygroundToolName = 'web_search' | 'dataset_retrieval';
```

### 3. 注册 `buildToolRegistry.ts`

```ts
import { createDatasetRetrievalTool } from './datasetRetrievalTool.js';

export type BuildToolRegistryOptions = {
  tavilyApiKey?: string;
  ragBaseUrl?: string;
  ragAuthToken?: string;
};

// buildToolRegistry 内：
if (options.ragBaseUrl && options.ragAuthToken) {
  registry.dataset_retrieval = createDatasetRetrievalTool(
    options.ragBaseUrl,
    options.ragAuthToken,
  );
}
```

### 4. `playgroundToolRegistry.ts` 传入 env

```ts
export const playgroundToolRegistry = buildToolRegistry({
  tavilyApiKey: env.TAVILY_API_KEY,
  ragBaseUrl: env.INTERNAL_API_BASE_URL,
  ragAuthToken: env.INTERNAL_SERVICE_TOKEN,
});
```

### 5. `resolveToolInvokeInput.ts`（schema 不是默认 `{ text }` 时）

```ts
import { DATASET_RETRIEVAL_TOOL_NAME } from './datasetRetrievalTool.js';

if (toolName === DATASET_RETRIEVAL_TOOL_NAME) {
  const query = typeof record.query === 'string' ? record.query.trim() : fallbackPrompt;
  const datasetId = typeof record.datasetId === 'string' ? record.datasetId.trim() : env.DEFAULT_DATASET_ID;
  return { query, datasetId };
}
```

### 6. `planningSystemHint.ts`（帮助线性 A 规划）

在 `Available tools:` 下增加一行，并写清与 `web_search` 的分工（内部文档 vs 联网）。

### 7. 单测 `datasetRetrievalTool.test.ts`

Mock `fetch`，断言返回字符串格式即可。

### 8. 无需改动的文件

- `agent/agentStreamRouter.ts` — 已自动用 registry
- `langgraph/langGraphChatStream.ts` — `listRegistryTools(registry)`
- `linear/linearChatStream.ts` — 同上
- 前端 — SSE `timeline` 已支持 `toolName` / `toolInput` / `toolOutput`

---

## 工具命名约定

| 项 | 约定 |
|----|------|
| `name` | `snake_case`，与 `PlaygroundToolName` 一致 |
| `description` | 写清 **何时用 / 何时不用**（与别的工具区分） |
| 返回值 | 纯文本，控制长度，便于进 `Tool observations` |
| 密钥 | 仅服务端 `env`，在 `buildToolRegistry` 里注入 |

---

## 本地验证

1. `apps/.env` 配好相关 key，重启 `pnpm dev`
2. Playground 提问，时间线应出现 `工具 / <name>`
3. `LANGGRAPH_ENABLED=false` 再走一遍，确认线性 A 也能调到
4. 临时让 LangGraph 抛错，确认仍 **fallback 到 A**（`agentStreamRouter`）

---

## 参考：现有 `web_search`

- 实现：`tavilyWebSearchTool.ts` + `formatTavilyResults.ts`
- 注册：`buildToolRegistry.ts`（有 `TAVILY_API_KEY` 才注册）
- 入参：`resolveToolInvokeInput.ts` 中 `query` 分支
