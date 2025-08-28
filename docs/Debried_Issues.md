## 2025-04-08 RAG 页面布局与交互目标偏差

- 现象：RAG 页面一度做成了“导入流程页”，包含数据源选择、切片预览和侧边文档列表，但用户最终希望它和 workflow/list-page 一样，直接是满宽卡片列表布局。
- 根因：前一版实现更偏向“上传后立即预览”的流程设计，没有严格复用 workflow/list-page 的信息架构，导致创建入口、列表展示和配置方式都偏离了预期。
- 修复：RAG 页面改成 4 列卡片网格，第一个卡片固定为“创建知识库”，后续卡片展示知识库列表；创建和继续导入统一收口到弹窗，只保留文本导入，移除 notion / web 同步入口。

## 2026-04-09 Jest matcher 选择不当导致 GitHub CI 失败

- 现象：AI 生成或修改的测试在本地看起来语义接近，但 CI 中因为 `toBe` / `toEqual` / `toMatchObject` 选错，出现断言失败或快照不一致，尤其容易发生在数组、对象和部分字段断言上。
- 根因：`toBe` 适合原始值和引用同一性，`toEqual` 适合深比较，`toMatchObject` 适合部分字段校验；如果把对象/数组误写成 `toBe`，或者把只需部分比对的场景写成全量 `toEqual`，在 CI 上很容易炸。
- 修复：在 Copilot 仓库规则中补充 Jest matcher 选择约束：原始值/枚举/布尔值/精确字符串优先 `toBe`，数组和对象结构比较用 `toEqual`，部分字段校验用 `toMatchObject`。后续生成测试时按这条规则执行。

## 2025-04-08 RAG 数据源不应依赖 catalog 与 seed 数据

- 现象：知识库页面和 workflow 知识检索链路虽然已经接到真实后端，但前端仍会把 `KNOWLEDGE_DATASET_CATALOG` 当默认数据，后端空库时也会自动生成 4 条 seed 数据，看起来仍像 mock 演示环境。
- 根因：`dataset-store.ts` 和 `knowledgeDatasetStore.ts` 都保留了“空数据时回退到样例知识库”的初始化策略，导致页面在没有真实数据时也会出现帮助中心、运营手册等预置分类。
- 修复：移除前端 catalog fallback 与后端 seed 初始化，默认知识库列表从空开始；RAG 首页首卡改成真实文件导入面板，支持拖拽文件、选择文件和打开文件夹批量导入，知识库名称直接从文件名或文件夹名推导。

## 2025-04-08 StartPanel 变量名输入时第二个字符开始被覆盖

- 现象：IfElse 节点先给 IF 分支追加了 iteration / loop，后续再从 ELSE 分支追加节点时，新节点的 y 位置可能仍按固定分支间距计算，和前一个已增高的容器节点发生重叠。
- 根因：`apps/web/src/pages/workflow/utils/workflow-node-utils.ts` 里的 `createNodeFromSource()` 在根层条件分支场景只按 `index * NODE_Y_OFFSET` 计算 y，没有读取前序分支目标节点的真实渲染高度；而 iteration / loop 会在配置后被 `useContainerNodeSync()` 动态拉高 `style.height`。
- 修复：条件分支新增节点时改为按 `_targetBranches` 顺序检查前序分支已连接节点，取“默认分支行距”和“前序目标节点底部 + 最小安全间距”两者中的较大值，避免 ELSE 压到已扩高的容器节点；同时补充纯函数测试覆盖该场景。

- 现象：在 Start 节点的“变量名”输入框里输入内容时，首个字符可以出现，但继续输入第二个字符后会被回退，看起来像“只能输入一个字母”。
- 根因：`apps/web/src/pages/workflow/compts/start-panel.tsx` 里的变量名编辑链路会在一次输入中触发两次 `setNodes`。第一次更新当前 Start 节点的 `inputs/outputs`，第二次又通过 `rewriteNodesVariableReferences()` 同步下游引用；两次更新基于不同快照执行，后一次会把前一次刚输入的字符覆盖掉。
- 修复：将“更新当前 Start 节点配置”和“同步下游 selector 引用”收敛到同一个 `setNodes` updater 中执行，并让 `use-start-panel-config.ts` 通过 `onChange(nextValue, meta)` 传递 rename/remove 元信息，避免连续状态更新互相覆盖。

- 现象：工作流页面编辑后没有自动保存，标题区持续显示“尚未保存”。
- 根因：`apps/web/src/pages/workflow/draft-page/workflow-children.tsx` 中 `useWorkflowDraftPersistence()` 被整段注释掉，导致 DSL 变化后不会触发 `schedulePersist()`，`draftUpdatedAt` 也就不会更新到 `useWorkflowDraftStore`。
- 修复：恢复页面对 `useWorkflowDraftPersistence()` 的接入，仅保留副作用调用，不额外引入未使用变量。

## 2025-04-08 Workflow 第一层容器节点 SearchBox 误用了子图作用域

- 现象：第一层的 loop / iteration 节点右侧追加菜单被错误限制成子图菜单，看起来像“根层节点也只能加循环结束 / 迭代结束”，而不是正常根层节点集。
- 根因：`apps/web/src/pages/workflow/draft-page/workflow-children.tsx` 里额外生成了 `effectiveSearchBoxScope`，把根层容器节点也强制映射成 `loop` / `iteration` 作用域，覆盖了 `resolveSearchBoxScope()` 基于 `parentId` 的真实判断。
- 正确规则：只有容器子节点和容器内部 start 节点使用 `loop` / `iteration` 作用域；第一层节点始终是 `root` 作用域。loop / iteration 子图内不允许再追加新的 loop / iteration，只允许追加对应的 `loop-end` / `iteration-end`，而不是通用 `end`。
- 修复：删除额外的强制作用域映射，统一使用 `resolveSearchBoxScope()` 的结果，并补纯函数测试覆盖根层与子图两种行为。

## 2025-03-28 图片历史恢复失败

- 根因：前端发送态使用 `imagePreviewUrl` 渲染图片，但历史恢复接口返回的是 `messages[].attachments`，恢复阶段没有把附件元数据映射成可渲染图片地址。
- 现象：当前上传后立即可见，刷新页面或切换历史 session 后图片消失，只剩文字消息。
- 修复：将“附件 -> 图片地址/名称”的解析收口到 `chatStreamHelpers`，恢复与渲染统一走同一逻辑，并保留发送态的 `data:` 预览优先级。

## 2025-03-28 图片历史恢复后与文字混在同一气泡

- 根因：图片分析实时发送时，前端本地状态会拆成“图片消息 + 文本消息”两条；但服务端历史落库曾写成一条 `attachments + content` 的用户消息。
- 现象：切换到历史会话后，图片和提示词一起出现在同一个气泡里，不再保持原来的两个 `article` 展示。
- 修复：服务端新写入图片历史时改为两条消息；前端恢复阶段增加兼容拆分逻辑，旧历史数据也会自动按两个气泡回显。

## 2025-04-01 工作流连线后边状态未初始化导致 undefined 报错

- 根因：React Flow 新建边时没有注入 `data`，而自定义边组件在首帧直接解构 `_sourceRunningStatus` / `_targetRunningStatus`，节点刚连接时会读取 `undefined`。
- 现象：节点连接后，自定义边渲染阶段抛错；同时边没有完整承载 Dify 所需的“初始无状态、下游启动再同步上游状态”的运行态语义。
- 修复：新增边运行态默认值工具，创建边时统一初始化 `_sourceRunningStatus: undefined`、`_targetRunningStatus: undefined`、`_waitingRun: true`，渲染侧改为通过安全默认值读取，避免首帧空数据崩溃。

## 2025-04-01 工作流连线已创建但边线不可见

- 根因：边颜色依赖 `--color-workflow-link-line-*` CSS 变量，但当前项目没有定义这些变量；自定义边的 `stroke` 会变成无效 CSS 值，SVG 路径不会渲染。
- 现象：节点连接成功、edge 数据存在，但画布上看不到连线。
- 修复：在公共样式中补齐工作流边颜色变量，并在边取色函数里增加 fallback 颜色，保证即使主题变量缺失也能正常显示。

## 2025-04-02 工作流节点点击后未弹出对应面板

- 根因：当前画布节点使用的是 `type: 'workflow' + data.kind` 结构，而右侧 panel 仍沿用旧的 `type: 'custom' + data.type` 判断；点击虽然会写入 `data.selected`，但面板解析不到对应组件。
- 现象：点击开始、LLM、结束等节点后，右侧没有显示对应配置 panel，看起来像点击无效。
- 修复：抽离统一的节点到 panel 解析函数，同时兼容旧 `custom` 节点和新 `workflow` 节点；右侧容器补齐定位与宽度，并在点击画布空白处时取消选中关闭 panel。

## 2025-04-02 工作流节点 panel 会被画布空白点击误关闭

- 根因：React Flow 的 `onPaneClick` 直接复用了“取消节点选中”逻辑，导致点击画布空白区域时会清空 `data.selected`，右侧 panel 也随之卸载。
- 现象：节点 panel 打开后，只要点到外层画布容器就会失焦并关闭，无法保持当前上下文继续编辑。
- 修复：将“画布空白点击”与“显式关闭 panel”拆成两条路径；前者不再改动选中态，后者仅由 panel 头部关闭按钮触发，同时补充节点/边选中同步纯函数单测。

## 2025-04-03 工作流 LLMPanel 之前无法真实保存节点配置

- 根因：右侧 panel 组件映射没有把当前节点 `id/data` 透传到具体面板，`llm` 节点也没有被 panel resolver 映射到 LLMPanel；同时画布 nodes/edges 仅存在于 ReactFlow 内存，未与 `workflowAppStore.dsl` 双向同步。
- 现象：LLM 节点即使点开右侧面板，也只能看到占位内容；即便面板后续写了本地 state，刷新页面后配置仍会丢失。
- 修复：补齐 `workflow -> llm` 的 panel 解析，面板装配链路改为透传节点 `id/data`；新增节点/边与 `workflowAppStore` 的最小 DSL 回填与保存逻辑；LLMPanel 配置统一写入 `node.data.inputs`，并随画布自动持久化。

## 2025-04-08 Zustand selector 返回新对象导致 Maximum update depth exceeded

- 根因：在 `useWorkflowDraftStore((state) => ({ ... }))` 这类 selector 里直接返回新对象时，如果没有做浅比较或缓存，React 会拿到不稳定的 snapshot；在 `useSyncExternalStore` 链路下会触发 “The result of getSnapshot should be cached” 和 `Maximum update depth exceeded`。
- 现象：页面渲染 `editing-title.tsx` 一类只读状态组件时，控制台报无限更新错误，组件栈会指向 workflow draft 状态展示区域。
- 修复：对返回对象的 Zustand selector 使用 `useShallow` 包裹，或者拆成多个基础字段 selector，保证 snapshot 可复用；本项目已在 `editing-title.tsx` 中改为 `useWorkflowDraftStore(useShallow(...))`。
