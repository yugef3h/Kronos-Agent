# Web 端重构设计文档

日期: 2026-05-31 | 分支: refactor/web

## 目标

按工业级标准拆分 `apps/web` 中的巨型文件，激活占位组件，改善组件边界。每个变更原子提交，保证业务逻辑零破坏。

## 重构范围

### 1. api.ts 拆分 (1354行 → 模块化)

```
lib/api/
  core.ts          # apiUrl, readApiErrorMessage 等基础工具
  types/
    session.ts     # Session 相关类型
    knowledge.ts   # Knowledge Dataset/Document 类型
    takeout.ts     # 外卖相关类型
    media.ts       # 图片/文件类型
    workflow.ts    # 工作流类型
  session.ts       # 会话 API
  knowledge.ts     # 知识库 API
  takeout.ts       # 外卖 API
  media.ts         # 图片/文件 API
  workflow.ts      # 工作流 API
  index.ts         # barrel export
```

**回退策略**: index.ts 保持原有导出签名不变，消费者无需改动。

### 2. usePlaygroundSendPrompt 拆分 (552行)

按三种发送路径拆为独立 hook：
- `useSendImagePrompt` — 图片分析
- `useSendFilePrompt` — 文件分析
- `useSendTextPrompt` — 文本 + 外卖 orchestration

共享逻辑提取到 `sendPromptUtils`。

### 3. useChatStreamController prop drilling 消除

引入 `ChatStreamContext` 承载 shared refs（activeRequestIdRef, activeControllerRef 等），消除跨层 prop 传递。

### 4. playgroundStore 按 Zustand slices 拆分

```
store/
  slices/
    chatSlice.ts
    sessionSlice.ts
    memorySlice.ts
    mediaSlice.ts
    takeoutSlice.ts
  playgroundStore.ts  # 组合 slices
```

store 的公共 API 不变，内部实现改为 slices 组合。

### 5. 注释组件处理

- HomePage 中注释的 `SamplingInspector`、`TokenEmbeddingPanel`、`ToolInvocationPanel` 保持注释
- 添加 `// TODO: ` 注释说明各组件用途
- MemorySummaryPanel 中注释的 updatedAt 保持

### 6. AgentOrchestratorPanel 激活

接入真实 timelineEvents 数据流，展示 Plan/Reason/Tool 三阶段可视化。

## 约束

1. 每一步独立可编译：改完 → `tsc --noEmit` → 通过 → commit
2. 每次 commit 只做一件事，可独立 revert
3. barrel export 保证对外 API 不变
4. 不删任何业务逻辑（包括注释掉的代码）
