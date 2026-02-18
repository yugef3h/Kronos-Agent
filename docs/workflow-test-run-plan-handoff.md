# Workflow 测试运行 — Plan 交接包

新对话可复制：

```
Workflow 测试运行 plan 已全部完成（Step 1–58）。
交接文档：docs/workflow-test-run-plan-handoff.md
```

---

## 已完成（Step 1–58）

| Step | 内容 | 路径 |
|------|------|------|
| 1–32 | Server 整图运行、FSM、SSE、cancel | `apps/server/src/workflow/` |
| 33–44 | Panel 单节点调试 + 上次运行 | `editor/compts/*-panel.tsx` |
| 45–54 | 画布测试运行 UI | `use-workflow-draft-run.ts`、`workflow-children.tsx` |
| 55 | Server `nodeRunRecord` + debug/graph 对齐 | `nodeRunRecord.ts`、`executorBridge.merge.test.ts` |
| 56 | Web 统一 `_lastRun` 快照 | `to-node-last-run-snapshot.ts`、`resolveNodeLastRun` |
| 57 | Draft-run E2E | `workflowDraftRunRoutes.e2e.test.ts`（含 if-else） |
| 58 | 画布合并 E2E | `workflow-draft-run-canvas-merge.test.ts` |

---

## 提交约定

- 每步只 `git add` 本轮文件
- 仓库根目录：`pnpm cd "feat|fix|test: 一句话"`
- 不要提交误改的 `apps/server/data/workflow-examples/*.json`
- 内置 `workflow-examples` 为**只读实例**（前端标注 + 服务端拒绝 PUT）；维护示例需 `WORKFLOW_EXAMPLES_WRITABLE=1`

---

## 目标效果

- 单节点：Panel「调试」+「上次运行」（debug / 整图共用快照结构）
- 整图：「测试运行」→ 事件回放 + `nodeRuns` → 画布态 + `_lastRun`
