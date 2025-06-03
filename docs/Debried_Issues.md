## 2026-03-28 图片历史恢复失败

- 根因：前端发送态使用 `imagePreviewUrl` 渲染图片，但历史恢复接口返回的是 `messages[].attachments`，恢复阶段没有把附件元数据映射成可渲染图片地址。
- 现象：当前上传后立即可见，刷新页面或切换历史 session 后图片消失，只剩文字消息。
- 修复：将“附件 -> 图片地址/名称”的解析收口到 `chatStreamHelpers`，恢复与渲染统一走同一逻辑，并保留发送态的 `data:` 预览优先级。

## 2026-03-28 图片历史恢复后与文字混在同一气泡

- 根因：图片分析实时发送时，前端本地状态会拆成“图片消息 + 文本消息”两条；但服务端历史落库曾写成一条 `attachments + content` 的用户消息。
- 现象：切换到历史会话后，图片和提示词一起出现在同一个气泡里，不再保持原来的两个 `article` 展示。
- 修复：服务端新写入图片历史时改为两条消息；前端恢复阶段增加兼容拆分逻辑，旧历史数据也会自动按两个气泡回显。

## 2026-04-01 工作流连线后边状态未初始化导致 undefined 报错

- 根因：React Flow 新建边时没有注入 `data`，而自定义边组件在首帧直接解构 `_sourceRunningStatus` / `_targetRunningStatus`，节点刚连接时会读取 `undefined`。
- 现象：节点连接后，自定义边渲染阶段抛错；同时边没有完整承载 Dify 所需的“初始无状态、下游启动再同步上游状态”的运行态语义。
- 修复：新增边运行态默认值工具，创建边时统一初始化 `_sourceRunningStatus: undefined`、`_targetRunningStatus: undefined`、`_waitingRun: true`，渲染侧改为通过安全默认值读取，避免首帧空数据崩溃。

## 2026-04-01 工作流连线已创建但边线不可见

- 根因：边颜色依赖 `--color-workflow-link-line-*` CSS 变量，但当前项目没有定义这些变量；自定义边的 `stroke` 会变成无效 CSS 值，SVG 路径不会渲染。
- 现象：节点连接成功、edge 数据存在，但画布上看不到连线。
- 修复：在公共样式中补齐工作流边颜色变量，并在边取色函数里增加 fallback 颜色，保证即使主题变量缺失也能正常显示。

## 2026-04-02 工作流节点点击后未弹出对应面板

- 根因：当前画布节点使用的是 `type: 'workflow' + data.kind` 结构，而右侧 panel 仍沿用旧的 `type: 'custom' + data.type` 判断；点击虽然会写入 `data.selected`，但面板解析不到对应组件。
- 现象：点击开始、LLM、结束等节点后，右侧没有显示对应配置 panel，看起来像点击无效。
- 修复：抽离统一的节点到 panel 解析函数，同时兼容旧 `custom` 节点和新 `workflow` 节点；右侧容器补齐定位与宽度，并在点击画布空白处时取消选中关闭 panel。

## 2026-04-02 工作流节点 panel 会被画布空白点击误关闭

- 根因：React Flow 的 `onPaneClick` 直接复用了“取消节点选中”逻辑，导致点击画布空白区域时会清空 `data.selected`，右侧 panel 也随之卸载。
- 现象：节点 panel 打开后，只要点到外层画布容器就会失焦并关闭，无法保持当前上下文继续编辑。
- 修复：将“画布空白点击”与“显式关闭 panel”拆成两条路径；前者不再改动选中态，后者仅由 panel 头部关闭按钮触发，同时补充节点/边选中同步纯函数单测。

## 2026-04-03 工作流 LLMPanel 之前无法真实保存节点配置

- 根因：右侧 panel 组件映射没有把当前节点 `id/data` 透传到具体面板，`llm` 节点也没有被 panel resolver 映射到 LLMPanel；同时画布 nodes/edges 仅存在于 ReactFlow 内存，未与 `workflowAppStore.dsl` 双向同步。
- 现象：LLM 节点即使点开右侧面板，也只能看到占位内容；即便面板后续写了本地 state，刷新页面后配置仍会丢失。
- 修复：补齐 `workflow -> llm` 的 panel 解析，面板装配链路改为透传节点 `id/data`；新增节点/边与 `workflowAppStore` 的最小 DSL 回填与保存逻辑；LLMPanel 配置统一写入 `node.data.inputs`，并随画布自动持久化。
