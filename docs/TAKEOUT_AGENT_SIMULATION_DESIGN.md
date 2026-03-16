# 外卖智能 Agent 落地设计与实现说明

## 1. 目标
这次重构不再把外卖流程硬塞在 `ChatStreamPanel` 内部，而是把它整理成可复用的 feature 模块。目标是让后续新增 agent/tool 时，可以直接沿用这套拆分方式：

- `容器层` 只负责聊天主链路与消息列表。
- `feature 层` 负责意图识别、流程状态机、消息注入与弹窗编排。
- `展示层` 只保留纯 UI 组件，不直接依赖聊天容器实现细节。

## 2. 当前目录结构

```text
apps/web/src/features/agent-tools/takeout/
├── components/
│   ├── TakeoutAuthModal.tsx
│   ├── TakeoutComboModal.tsx
│   ├── TakeoutMessageCard.tsx
│   ├── TakeoutPaymentModal.tsx
│   └── TakeoutToolModals.tsx
├── data/
│   └── mockData.ts
├── services/
│   └── doubaoMockApi.ts
├── helpers.ts
├── helpers.test.ts
├── index.ts
├── types.ts
└── useTakeoutTool.tsx
```

## 3. 拆分原则

### 3.1 容器接入面最小化
`ChatStreamPanel` 现在只需要做四件事：

1. 判断输入是否命中外卖意图。
2. 调用 `useTakeoutTool()` 启动或推进流程。
3. 在消息列表中渲染 `TakeoutMessageCard`。
4. 在面板底部挂载 `TakeoutToolModals`。

### 3.2 纯函数先行
以下逻辑都被抽到 `helpers.ts`，方便后续复用和测试：

- 意图识别
- 默认快捷提示词
- 订单摘要拼装
- 套餐摘要拼装
- 支付金额计算
- 外卖卡片消息类型判断

### 3.3 状态机集中在 hook
`useTakeoutTool.tsx` 统一管理：

- 当前 flowId
- 商品、套餐、小食选择
- 授权 / 套餐 / 支付三类弹窗状态
- 卡片消息注入
- 失败兜底话术

这让 UI 组件保持“只接 props，不碰流程”。

## 4. 对后续新 Agent 的参考方式
如果后面要接入新的 agent/tool，建议直接复制这套模式：

1. 在 `apps/web/src/features/agent-tools/<tool-name>/` 下建立独立目录。
2. 先抽 `types.ts` 与 `helpers.ts`，把输入识别、展示判断、摘要拼装放进去。
3. 再写 `use<FeatureName>Tool.tsx`，把流程状态机、消息插入、错误处理放进去。
4. 最后写 `components/`，只做纯展示与交互分发。
5. 在 `index.ts` 统一导出，保证主聊天容器只依赖一个入口。

## 5. 本次顺手修正的问题

- 协议同意阶段现在真正走 `callDoubaoAPI('协议同意回复')`，避免数据源分散。
- 结算卡片与支付弹窗统一复用同一套金额计算，消除了之前 `+36` 与 `+6` 不一致的问题。
- 用户选择的小食不再在进入结算阶段时被清空，结算摘要能够正确保留真实选择。

## 6. 测试与运行

- 纯函数测试位于 `apps/web/src/features/agent-tools/takeout/helpers.test.ts`
- 运行前端 lint：`npm run lint --workspace @kronos/web`
- 运行根测试：`npm test -- --runInBand`
