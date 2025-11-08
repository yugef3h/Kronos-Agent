# RAG 页面现状评估与改造计划（基于 `RagPage.tsx`）

## 当前页面做到的程度（结论）
当前 `RagPage` 已达到 **“入库与切片管理较完整”** 阶段，接近“标准完整 RAG”的上半段（知识准备侧），但还未进入 Dify 架构的检索增强与问答编排阶段。

## 已完成能力（页面可见）
1. **知识库生命周期管理**
- 数据集列表、创建（导入时自动创建）、删除、URL 级数据集选择同步。

2. **文档导入链路**
- 支持文件/文件夹/拖拽导入，支持文件类型过滤与拒绝原因提示。
- 导入前参数校验（分段长度、重叠长度、分隔符、TopK、元数据字段）。

3. **切片策略配置与预估**
- 可配置预处理规则（去多余空格、去 URL/邮箱）。
- 可配置 segmentation / overlap / parent_mode / subchunk_segmentation。
- 已接入 indexing-estimate 预估接口并生成本地 preview chunks。

4. **文档与分块可观测性**
- 可查看 dataset 下 documents 与 blocks。
- blocks 支持关键词编辑（新增/删除）并回写服务端。

5. **鉴权与错误处理基础**
- 所有关键知识库接口均走 JWT 校验。
- 具备导入成功/失败摘要、局部失败容错（按文件统计失败）。

## 当前缺口（对标 Dify 核心能力）
1. **检索问答闭环未在本页形成**
- 页面未直接承载 query -> retrieval -> answer 的主交互（仅有入库与切片侧能力）。

2. **检索增强不足**
- 未体现重排（Rerank）、混合检索（向量+关键词/BM25）、多路召回融合。

3. **切片与索引策略仍偏手工**
- 缺少按文档类型自适应切片模板、实验对比（召回率/命中率）与自动调参闭环。

4. **知识治理能力不足**
- 缺少多租户/空间级隔离策略展示、来源引用可视化、版本与回滚策略、文档状态机（处理中/失败重试）。

5. **前端工程可维护性风险**
- `RagPage.tsx` 体量过大（1000+ 行），状态与副作用集中，后续扩展检索面板会继续放大复杂度。

## 改造计划（由浅入深）

### Phase 1：页面解耦与性能基础（先做）
目标：降低页面复杂度，为检索能力扩展留空间。

- 拆分为 hooks + 子容器：
  - `useRagDatasetList`
  - `useRagImportFlow`
  - `useRagDocumentDetail`
  - `useRagChunkKeywords`
- 将 `RagImportDialog`、`RagDatasetDetailDialog` 按需懒加载（dynamic import 思路）。
- 合并/收敛重复校验逻辑（preview 与 import 共用一套 schema）。
- 保持异步并发请求 `Promise.all`/`allSettled`，避免串行 waterfall。

### Phase 2：补齐检索验证闭环（最小可用）
目标：从“能入库”升级到“可验证检索质量”。

- 在页面新增“检索调试区”：
  - 输入 query
  - 设置 TopK / score 阈值
  - 展示召回 chunks 与 metadata/source
- 接入 `requestKnowledgeRetrievalQuery`，打通 dataset -> query -> chunks。
- 增加“切片参数 -> 召回结果”对比视图（同 query 下对比不同分段配置）。

### Phase 3：向 Dify 能力靠拢（增强检索）
目标：提升召回质量与稳定性。

- 引入 rerank 开关与重排模型配置。
- 增加 hybrid retrieval（关键词召回 + 向量召回）并做融合排序。
- 支持 metadata filter（来源、时间、标签）和 namespace 隔离。
- 增加引用片段可追溯展示（文档名、片段序号、命中分数）。

### Phase 4：生产级治理与评估
目标：可持续迭代与质量可度量。

- 建立离线评测集（问题-标准片段），输出 Recall@K / MRR / 命中率。
- 导入链路加入任务状态、重试、失败原因分类。
- 增加策略版本化：切片配置、检索参数、重排策略可回滚。

## 当前阶段定级
- **整体判断**：`入门版RAG` 向 `标准完整RAG` 过渡中（知识准备侧较完整）。
- **距离“接近 Dify 架构”** 的核心差距：检索增强（rerank/hybrid/filter）+ 质量评估闭环 + 治理能力。