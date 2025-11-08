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

---

## LangChain 在本项目中的实际使用情况

### 结论（先读这段）
- **LangChain 自带的「RAG 一条龙」能力（Document Loader → Text Splitter → VectorStore → Retriever → Retrieval Chain）在知识库流水线里基本没有用到。**
- 知识库侧：**文档解析、切块、落盘、检索打分** 由自研服务实现（如 `knowledgeChunkingService`、`knowledgeDocumentStore`、`knowledgeRetrievalService`），不依赖 LangChain 的 VectorStore / Retriever API。
- **LangChain 在项目里主要用在「对话 / Agent / 工作流」与「Token+Embedding 分析」**：`@langchain/core`（消息）、`@langchain/openai`（`ChatOpenAI`、`OpenAIEmbeddings`）、`@langchain/langgraph`（如 `createReactAgent`）。
- `package.json` 里声明了 `@langchain/textsplitters`，**当前代码中未见引用**，切块逻辑在 `knowledgeChunkingService` 自研。

### LangChain「RAG 相关模块」 vs 当前实现（对照表）

| 能力域 | LangChain 常见用法（RAG 侧） | 当前项目实际 |
|--------|------------------------------|--------------|
| 文档加载 | `DocumentLoader`（PDF、Web 等） | 自研 `extractDocumentText` / `documentTextExtractor` 等解析链路 |
| 文本切分 | `RecursiveCharacterTextSplitter` 等 | 自研 `splitTextToChunks`（`knowledgeChunkingService`），参数与 Dify 式 `process_rule` 对齐由前后端约定 |
| Embedding | `OpenAIEmbeddings` / 其他 Embeddings | 主知识库检索里的「semantic」为 **统计相似度（如 bigram + 词重叠）**，**不是** LangChain 式向量嵌入检索；`OpenAIEmbeddings` 仅用于 **`tokenEmbeddingService`（Token/向量分析工具）** |
| 向量存储 | `MemoryVectorStore`、`PGVector`、`Chroma` 等 | **JSON 索引 + 磁盘 chunks（jsonl）** 等自研存储（`knowledgeDocumentStore`），与 LangChain VectorStore **无对接** |
| 检索器 | `VectorStoreRetriever`、`EnsembleRetriever` 等 | **自研打分与融合**（`keyword_search` / `full_text_search` / `hybrid_search` / `semantic_search` 等分支，见 `knowledgeRetrievalService`），非 LangChain Retriever |
| RAG 链 / LCEL | `createRetrievalChain`、`RunnableSequence` 等 | **无**；问答若在工作流里走 LLM，编排更偏 **LangGraph + 工具**，知识检索走 **HTTP `knowledge-retrieval/query`** |
| 重排 | `CohereRerank`、社区 rerank 封装等 | 有 **`applyReranking` 启发式加分**（整句命中、词命中、标题 boost），**非** LangChain / 第三方 rerank 模型调用 |

---

## 在「不改变类 Dify 需求」的前提下，如何用 LangChain 做 RAG

**原则**：产品层保持 **数据集 / 文档 / 分块 / 检索参数 / 元数据过滤** 等与 Dify 一致的体验与 API 形状；LangChain 只作为 **服务端实现细节或可选引擎**，对外契约不变。

### 推荐架构（由保守到激进）

1. **适配器模式（最稳妥，类 Dify 不变）**  
   - 对外：继续提供现有 REST（如 `knowledge-datasets/*`、`knowledge-retrieval/query`）。  
   - 对内：新建一层 `LangChainKnowledgePipeline`，用 `Document` →（可选）`TextSplitter` → `Embeddings` → `VectorStore` 实现**同一语义**的入库与检索，再通过适配器把结果转成当前 `KnowledgeRetrievalResultItem` 等类型。  
   - 前端与 `RagPage` **无需**知道底层是 LangChain 还是手写循环。

2. **仅替换「某一环」（渐进）**  
   - 只把 **切分** 换成 `@langchain/textsplitters`（参数仍从现有 `segmentMaxLength` / `separator` 映射），存储与 API 不动。  
   - 或只把 **向量索引与相似度检索** 换成 LangChain `VectorStore` + `similaritySearchWithScore`，**HTTP 响应字段保持不变**。

3. **编排层用 LangGraph，检索仍可调现有服务**  
   - 在已有 LangGraph 工作流中增加节点：`retrieve` 节点内部调用现有 `knowledgeRetrievalService`（或未来 LangChain 版适配器），`generate` 节点用现有 `ChatOpenAI`。  
   - 用户感知仍是「工作流 + 知识库」，与 Dify「应用 + 知识库」一致。

### 不建议的做法（会破坏「类 Dify」一致性）
- 让前端直接依赖 LangChain JS 做切块或向量检索（bundle、密钥、行为与 Dify 式服务端治理都不一致）。  
- 直接改用 LangChain 默认的 chunk/metadata 形状作为对外 API，而不做字段映射。

---

## 小结（给决策用的一句话）
**当前 RAG 数据面几乎全是自研；LangChain 负责的是 LLM/Agent 与部分 Embedding 工具能力。** 若要用 LangChain 强化 RAG 又不改产品形态，应在 **服务端用适配器承接 LangChain 的 Document/Splitter/VectorStore/Retriever**，并 **冻结对外 REST 与 Dify 式配置模型**。