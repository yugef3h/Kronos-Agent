# Workflow 测试运行 — Plan 交接包

新对话开场可复制：

```
继续 Kronos workflow 测试运行 plan，从 Step 55 开始。
交接文档：docs/workflow-test-run-plan-handoff.md
单步实现，每步结束让我来允许你的 pnpm cd。
```

---

## 已完成（Step 1–54）

| Step | 内容 | 路径 |
|------|------|------|
| 1–32 | Server 整图运行、FSM、SSE、cancel | `apps/server/src/workflow/` |
| 33–44 | Panel 单节点调试 + 上次运行 | `editor/compts/*-panel.tsx`、`panel-last-run*` |
| 45 | `useWorkflowDraftRun` | `hooks/use-workflow-draft-run.ts` |
| 46 | `applyRunEventToCanvas` | `utils/apply-run-event-to-canvas.ts` |
| 47 | `NodeRunStatusIcon` | `compts/node-run-status-icon.tsx` |
| 48 | 节点标题状态图标 | `container-node-ui.tsx` |
| 49 | 运行中虚线边框 | `utils/get-node-run-border-class.ts` + `workflow-children.tsx` |
| 50 | 测试运行输入弹窗 | `compts/workflow-test-run-input-dialog.tsx` |
| 51 | 「测试运行」按钮接线 | `workflow-children.tsx` |
| 52 | 整图结束写 `_lastRun` | `applyNodeLastRunsFromDraftRun` |
| 53 | 运行摘要条 | `compts/workflow-run-summary-bar.tsx` |
| 54 | 运行中锁定画布编辑 | `nodesDraggable` / `nodesConnectable` / `onConnect` |

`workflowRunApi.ts`：`StartWorkflowDraftRunResponse` 含 `nodeRuns`。

---

## 下一步（Step 55 起）

| Step | 轨 | 任务 |
|------|-----|------|
| 55–58 | 合并 | 双轨合并 + E2E |

---

## 提交约定

- 每步只 `git add` 本轮文件
- 仓库根目录：`pnpm cd "feat|fix|test: 一句话"`
- 不要提交误改的 `apps/server/data/workflow-examples/*.json`

---

## 目标效果

- 单节点：Panel「调试」+「上次运行」
- 整图：「测试运行」→ 画布节点态/边高亮 + 摘要条 + 运行结束写 `_lastRun`
