# Contributing to Kronos-Agent

感谢参与贡献。本项目采用 **Fork → 分支 → Pull Request** 流程；非维护者请勿直接向本仓库主分支 push。

## 本地开发

```bash
pnpm install
cp apps/.env.example apps/.env   # 填写 JWT、豆包等
pnpm dev                         # 前端 + Node 服务（默认）
```

- 仅前端：`pnpm dev:web`
- Node 服务：`pnpm dev` / `pnpm dev:server:node`
- Python 服务：`pnpm dev:server:py`（需先 `pnpm install:server-py`）
- Python 测试：`pnpm test:py`
- 更多脚本见根目录 `package.json` 与 [README.md](./README.md)

## 提交前自检

与 [CI](.github/workflows/ci.yml) 一致，推送前请通过：

```bash
pnpm lint
pnpm test
pnpm build
```

建议额外执行 `pnpm format:check`（或 `pnpm format` 自动修复）。

## Pull Request 规范

1. **范围**：一个 PR 只做一件事（功能或修复），便于 review。
2. **说明**：标题与描述写清「改了什么 / 为什么 / 如何验证」；关联 issue 可用 `Fixes #123`。
3. **测试**：新逻辑补充单元测试；新增或变更外部 API 时补充集成测试。
4. **文档**：影响公开 API、环境变量或用户可见行为时，同步更新 README 或 `docs/`。
5. **范围提示**：
   - `apps/web` — Playground、Workflow 编排、RAG 界面
   - `apps/server` / `apps/server_py` — API、memory、RAG、workflow 运行
   - `packages/core` — 共享领域层

## 第三方代码与许可证

项目为 [Apache-2.0](./LICENSE)。引入外部代码时请：

- 保留原始版权与许可证声明；
- 修改过的第三方文件在文件内注明变更说明与日期。

## 问题与讨论

Bug、功能建议请先开 Issue，再提 PR，便于对齐方案与避免重复劳动。
