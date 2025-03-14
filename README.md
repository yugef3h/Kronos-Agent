# Kronos Agent: LLM Insight Playground

探索 LLM 原理与 Agent 工程化的前端主导项目，目标是让前端工程师能用可视化手段掌握并落地 AI Agent 系统。

当前版本已完成第一轮架构重构：从单体 demo 升级为可扩展的 monorepo，适合逐步接入 LangChain 的 Chain / Agent / Memory / Tool。

## 技术栈

- 前端: React 18 + TypeScript + Vite 5 + TailwindCSS + Zustand + React Query
- 可视化: D3 / ECharts（预留）
- 后端: Express + TypeScript + SSE
- 共享域层: `@kronos/core`（采样等基础领域逻辑）

## 目录结构

```text
apps/
	web/                # 前端应用（可视化工作台）
	server/             # 后端 API（SSE + 会话 + 调试接口）
packages/
	core/               # 共享领域层（采样、类型、工具契约）

node/                 # legacy server（保留）
src/                  # legacy browser demo（保留）
templates/            # legacy html 模板（保留）
Draft.md              # 项目策略与面试叙事草稿
```

## 快速启动

```bash
npm install
npm run dev
```

服务端需要先配置环境变量：复制 `apps/server/.env.example` 为 `apps/server/.env`，并填写 JWT 与豆包模型参数。

访问:

- 前端: http://localhost:5173
- 后端健康检查: http://localhost:3001/healthz

## MVP 对应能力

- SSE Chat Stream（支持流式 Token 展示）
- Sampling Inspector（温度 / Top-P 参数对概率分布影响）
- Attention Heatmap（注意力矩阵可视化占位，后续接真实链路）
- Token/Embedding Visualizer（token IDs + 向量 2D 投影）

## 安全与模型接入

- API 路由统一启用 JWT Bearer 鉴权。
- LangChain.js 通过 OpenAI 兼容接口接入豆包模型。
- 未配置豆包环境变量时，后端会自动回退到 mock stream，便于本地 UI 调试。
- Token/Embedding 分析接口：`POST /api/token-embedding/analyze`。
- Token/Embedding 支持 `projectionMethod(random/pca/umap)`、对比分词器、对比 Embedding 模型，并返回 Token 重叠率与邻域一致率。
- Token/Embedding 面板支持主模型→对比模型位移箭头热力层，用于直观看 Chunk 表征漂移。
- Token/Embedding 面板支持 Top-K 最大漂移 Chunk 列表，点击可高亮对应位移箭头。
- Top-K 选中项会在主模型与对比模型双图同步高亮对应点，便于演示对比路径与落点。

开发态 JWT 自动签发流程见 `docs/JWT_DEV_TOKEN.md`。

## 下一步规划（LangChain 接入）

1. 在 `apps/server` 新增 `langchain/` 模块，拆分 Chain/Agent/Tool。
2. 在 `apps/web` 新增工作流面板，展示 ReAct 轨迹与工具调用。
3. 在 `packages/core` 落地统一事件协议，支持前后端同构调试。

## Apache 2.0 合规声明模板（已启用）

本项目已采用 Apache License 2.0，并提供一套可复用的合规模板：

- LICENSE：完整 Apache-2.0 许可证文本。
- NOTICE：项目版权与归属声明。
- THIRD_PARTY_NOTICES.md：第三方依赖及许可证归档。
- 源码文件 SPDX 头：使用 `SPDX-License-Identifier: Apache-2.0` 标识。

### 新增文件时建议复制的头注释模板

JavaScript:

```js
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Kronos-Agent Contributors
```

HTML:

```html
<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright (c) 2026 Kronos-Agent Contributors -->
```

### 维护建议

- 新增依赖后，同步更新 THIRD_PARTY_NOTICES.md。
- 引入外部代码时，保留原始版权与许可证声明。
- 对已修改的第三方文件，在文件内显式标注变更说明与日期。


