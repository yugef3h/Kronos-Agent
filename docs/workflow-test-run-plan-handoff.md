# Workflow 测试运行 — Plan 交接包

新对话开场可复制：

```
继续 Kronos workflow 测试运行 plan，从 Step 33 开始。
交接文档：docs/workflow-test-run-plan-handoff.md
单步实现，每步结束让我来允许你的 pnpm cd。
```

---

## 已完成（Step 1–32）

| Step | 内容 | 路径 |
|------|------|------|
| 1 | Server run 类型 | `apps/server/src/workflow/types.ts` |
| 2 | Web run 类型 | `apps/web/src/domains/workflow/editor/types/run.ts` |
| 3 | Canvas 运行字段 | `apps/web/src/domains/workflow/editor/types/canvas.ts` |
| 4 | DSL 校验 start/end | `apps/web/.../utils/validate-runnable-dsl.ts` |
| 5 | DSL 校验容器 | 同上 |
| 6 | WorkflowRunStore | `apps/server/src/workflow/workflowRunStore.ts` |
| 7 | draft-runs 501 占位 | `apps/server/src/routes/workflowDraftRunRoutes.ts` |
| 8 | Web workflowRunApi | `apps/web/src/domains/workflow/app/workflowRunApi.ts` |
| 9 | 单节点注册表 | `apps/server/src/workflow/nodeDebugExecutors.ts` |
| 10 | start debug | `apps/server/src/workflow/debug/startNodeDebugExecutor.ts` |
| 11 | end debug | `apps/server/src/workflow/debug/endNodeDebugExecutor.ts` |
| 12 | if-else debug | `apps/server/src/workflow/debug/ifElseNodeDebugExecutor.ts` |
| 13 | llm debug | `apps/server/src/workflow/debug/llmNodeDebugExecutor.ts` |
| 14 | knowledge debug | `apps/server/src/workflow/debug/knowledgeRetrievalNodeDebugExecutor.ts` |
| 15 | debug/node 路由 | `apps/server/src/routes/workflowNodeDebugRoutes.ts` |
| 16 | start route 测试 | `workflowNodeDebugRoutes.start.test.ts` |
| 17 | knowledge route 测试 | `workflowNodeDebugRoutes.knowledge.test.ts` |
| 18 | debug 进 RunStore | `workflowRunStore.saveNodeDebugRun` |
| 19 | workflowFsm | `apps/server/src/workflow/workflowFsm.ts` |
| 20 | nodeFsm | `apps/server/src/workflow/nodeFsm.ts` |
| 21 | buildExecutionGraph | `apps/server/src/workflow/buildExecutionGraph.ts` |
| 22 | RunContext | `apps/server/src/workflow/runContext.ts` |
| 23 | nodeExecutors | `apps/server/src/workflow/nodeExecutors.ts` |
| 24 | start 整图 | `executors/startNodeExecutor.ts` + `workflowDraftRunner.ts` |
| 25 | llm 整图 | `executors/llmNodeExecutor.ts` |
| 26 | knowledge 整图 | `executors/knowledgeRetrievalNodeExecutor.ts` |
| 27 | if-else 分支 | `buildExecutionGraph.outboundEdges` + `ifElseNodeExecutor` |
| 28 | end + draft-runs API | `POST …/draft-runs` 同步执行 start→…→end |
| 29 | loop 沙盒 | `container/*` + `executors/loopNodeExecutor.ts` |
| 30 | iteration 沙盒 | `executors/iterationNodeExecutor.ts` |
| 31 | SSE 事件回放 | `workflowRunEvents.ts` + `GET …/events` |
| 32 | cancel + 超时 | `workflowRunCancellation.ts` + runner `maxSteps`/`timeoutMs` |

注册入口：`registerNodeDebugExecutors.ts`（单节点）、`registerNodeExecutors.ts`（整图）

---

## 下一步（Step 33 起）

| Step | 轨 | 任务 |
|------|-----|------|
| 33–44 | S 前端 | PanelLastRun、useNodeDebugRun、各 panel |
| 45–54 | W 前端 | 测试运行、画布态 |
| 55–58 | 合并 | 双轨合并 + E2E |

---

## 提交约定

- 每步只 `git add` 本轮文件
- 仓库根目录：`pnpm cd "feat|fix|test: 一句话"`
- 不要提交误改的 `apps/server/data/workflow-examples/*.json`

---

## 并行轨（少冲突）

- **S 轨**：`debug/*`、`workflow/debug/node` 路由、`*-panel.tsx`
- **W 轨**：`workflowFsm`、`draft-runs` 实现、`workflow-children.tsx`
- Step 39（knowledge _lastRun 迁移）与 Step 52（整图写 _lastRun）分开提交

---

## 目标效果

- 单节点：Panel「调试」+「上次运行」展示 I/O
- 整图：「测试运行」→ FSM + loop/iteration 沙盒 → 节点虚线/图标 + 边线高亮
