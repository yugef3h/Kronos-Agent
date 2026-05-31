# Web 端重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement.

**Goal:** 拆分 apps/web 巨型文件，激活占位组件，改善组件边界。每个变更原子提交，零业务破坏。

**Architecture:** 按域模块化 api 层 → 拆分巨型 hook → Context 消除 prop drilling → Zustand slices → 激活 AgentOrchestratorPanel

**Tech Stack:** React 18, TypeScript, Zustand, Vite, TailwindCSS

**约束：** 每步 `npx tsc -p tsconfig.build.json --noEmit` 通过后 commit。barrel export 保持兼容。

---

## Phase 1: api.ts 类型拆分

### Task 1.1: 提取 session/types → lib/api/types/session.ts

**Files:**
- Create: `apps/web/src/lib/api/types/session.ts`
- Modify: `apps/web/src/lib/api.ts`

从 `api.ts` 提取以下类型到新文件，并在 api.ts 中 re-export：

提取类型: `DevTokenResponse`, `SessionSnapshotResponse`, `PlaygroundHistorySurface`, `RecentDialogueItem`, `RecentDialogueItemDto`, `RecentSessionResponse`, `HotTopicsResponse`, `SessionAppendMessage`

- [ ] **Step 1: 创建 `lib/api/types/session.ts`**，粘贴上述类型定义
- [ ] **Step 2: 从 `api.ts` 删除这些类型**，改为 `export type { ... } from './api/types/session'`
- [ ] **Step 3: `npx tsc -p tsconfig.build.json --noEmit`** 验证
- [ ] **Step 4: Commit** `git add apps/web/src/lib/api/types/session.ts apps/web/src/lib/api.ts && git commit -m "refactor: extract session types from api.ts"`

### Task 1.2: 提取 knowledge/types → lib/api/types/knowledge.ts

提取所有 `Knowledge*` 开头的类型 + `DatasetIndexingEstimateResponse`

- [ ] **Step 1: 创建 `lib/api/types/knowledge.ts`**
- [ ] **Step 2: `api.ts` 中替换为 re-export**
- [ ] **Step 3: `npx tsc --noEmit`** 验证
- [ ] **Step 4: Commit**

### Task 1.3: 提取 takeout/types → lib/api/types/takeout.ts

提取所有 `Takeout*` 开头的类型

- [ ] **Step 1: 创建 `lib/api/types/takeout.ts`**
- [ ] **Step 2: `api.ts` 中替换为 re-export**
- [ ] **Step 3: `npx tsc --noEmit`** 验证
- [ ] **Step 4: Commit**

### Task 1.4: 提取 media/types → lib/api/types/media.ts

提取 `ImageHostUploadResponse`, `ImageRecognitionResponse`, `FileAnalysisResponse`, `TokenEmbeddingAnalyzeResponse`

- [ ] **Step 1: 创建 `lib/api/types/media.ts`**
- [ ] **Step 2: `api.ts` 中替换为 re-export**
- [ ] **Step 3: `npx tsc --noEmit`** 验证
- [ ] **Step 4: Commit**

## Phase 2: api.ts 函数拆分

### Task 2.1: 提取 core 工具函数 → lib/api/core.ts

提取: `readViteApiBaseUrl`, `resolveApiBaseUrl`, `apiUrl`, `knowledgeDatasetApiPath`, `ApiErrorPayload`, `extractStructuredApiErrorMessage`, `readApiErrorMessage`, `tryParsePublishedPlaygroundStreamSessionId`, `normalizeRecentDialogueItemDto`

- [ ] **Step 1: 创建 `lib/api/core.ts`**，粘贴上述函数
- [ ] **Step 2: `api.ts` 中 import 并 re-export**
- [ ] **Step 3: `npx tsc --noEmit`** 验证
- [ ] **Step 4: Commit** `git commit -m "refactor: extract api core utilities to lib/api/core.ts"`

### Task 2.2: 创建 lib/api/types/index.ts barrel

- [ ] **Step 1: 创建 `lib/api/types/index.ts`**，re-export 所有子模块
- [ ] **Step 2: `npx tsc --noEmit`** 验证
- [ ] **Step 3: Commit**

### Task 2.3: 提取 session API → lib/api/session.ts

提取: `requestDevToken`, `requestSessionSnapshot`, `requestRecentSessions`, `requestHotTopics`, `requestAppendSessionMessages` 及相关类型

- [ ] **Step 1: 创建 `lib/api/session.ts`**
- [ ] **Step 2: `api.ts` 中替换为 import + re-export**
- [ ] **Step 3: 更新所有外部 import 路径**（搜索 `from '../../../lib/api'` 中引用这些函数的文件）
- [ ] **Step 4: `npx tsc --noEmit`** 验证
- [ ] **Step 5: Commit**

### Task 2.4: 提取 takeout API → lib/api/takeout.ts

提取所有 `requestTakeout*` 函数

- [ ] **Step 1-5: 同上模式** → Commit

### Task 2.5: 提取 media API → lib/api/media.ts

提取 `requestImageHostUpload`, `requestImageRecognition`, `requestFileAnalysis`, `requestTokenEmbeddingAnalysis`

- [ ] **Step 1-5: 同上模式** → Commit

### Task 2.6: 提取 knowledge API → lib/api/knowledge.ts

提取所有 `requestKnowledge*` + `requestDatasetIndexingEstimate` 函数

- [ ] **Step 1-5: 同上模式** → Commit

### Task 2.7: 提取 workflow API → lib/api/workflow.ts

提取 `putWorkflowDraftPreview`, `Knowledge*` 类型（如果还残留）

- [ ] **Step 1-5: 同上模式** → Commit

### Task 2.8: 创建 lib/api/index.ts barrel

- [ ] **Step 1: 创建 `lib/api/index.ts`**，re-export 所有模块
- [ ] **Step 2: 更新所有内部 import 为 barrel import**
- [ ] **Step 3: `npx tsc --noEmit`** 验证
- [ ] **Step 4: Commit**

## Phase 3: usePlaygroundSendPrompt 拆分

### Task 3.1: 提取共享工具函数

提取: 发送前 guard 检查、消息构建辅助函数

- [ ] **Step 1: 创建 `features/chat-stream/hooks/sendPromptUtils.ts`**
- [ ] **Step 2: 移动 `markLastAssistantIncomplete` 等共享逻辑**
- [ ] **Step 3: `npx tsc --noEmit`** 验证
- [ ] **Step 4: Commit**

### Task 3.2: 提取 useSendImagePrompt

- [ ] **Step 1: 创建 `features/chat-stream/hooks/useSendImagePrompt.ts`**
- [ ] **Step 2: 从 usePlaygroundSendPrompt 提取图片发送逻辑**
- [ ] **Step 3: usePlaygroundSendPrompt 中改为调用 useSendImagePrompt**
- [ ] **Step 4: `npx tsc --noEmit`** 验证
- [ ] **Step 5: Commit**

### Task 3.3: 提取 useSendFilePrompt

- [ ] **Step 1-5: 同上模式** → Commit

### Task 3.4: 提取 useSendTextPrompt（文本 + 外卖）

- [ ] **Step 1-5: 同上模式** → Commit

## Phase 4: useChatStreamController Context 消除 prop drilling

### Task 4.1: 创建 ChatStreamContext

- [ ] **Step 1: 创建 `features/chat-stream/ChatStreamContext.tsx`**，承载 shared refs + shared callbacks
- [ ] **Step 2: ChatStreamPanel 中用 Provider 包裹**
- [ ] **Step 3: 更新一个子 hook 改为从 context 读取**（验证模式可行）
- [ ] **Step 4: `npx tsc --noEmit`** 验证
- [ ] **Step 5: Commit**

### Task 4.2: 迁移所有子 hook 到 Context

- [ ] **Step 1-5: 逐个迁移余下的 hook** → Commit

## Phase 5: playgroundStore Zustand slices

### Task 5.1: 创建 chatSlice

- [ ] **Step 1: 创建 `store/slices/chatSlice.ts`**
- [ ] **Step 2: playgroundStore 组合 chatSlice**
- [ ] **Step 3: `npx tsc --noEmit`** 验证
- [ ] **Step 4: Commit**

### Task 5.2-5.5: 依次创建 sessionSlice, memorySlice, mediaSlice, takeoutSlice

同上模式，每个 slice 一个 commit。

## Phase 6: 注释代码处理

### Task 6.1: HomePage 注释组件添加 TODO

- [ ] **Step 1: 在 HomePage.tsx 注释处添加说明**
- [ ] **Step 2: Commit**

### Task 6.2: MemorySummaryPanel 注释恢复（保持注释但加说明）

- [ ] **Step 1: 添加 TODO 说明**
- [ ] **Step 2: Commit**

## Phase 7: AgentOrchestratorPanel 激活

### Task 7.1: 接入 timeline 数据

- [ ] **Step 1: 在 AgentOrchestratorPanel 中订阅 playgroundStore.timelineEvents**
- [ ] **Step 2: 按 stage (plan/tool/reason) 分组展示**
- [ ] **Step 3: 添加 timeline 事件卡片组件**
- [ ] **Step 4: `npx tsc --noEmit`** 验证
- [ ] **Step 5: Commit**
