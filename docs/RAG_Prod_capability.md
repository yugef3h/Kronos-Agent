# Dify 功能能力完整清单（按：完全支持 → 基础弱支持 → 需二次开发/外接 排序，可直接复制给LLM）
## 一、Dify 原生完全支持功能（开箱即用，无需额外开发）

> **Kronos-Agent 对照（本节）**：下表仍是 Dify 能力基线；每条后附本仓库落地情况。默认 `RAG_ENGINE_MODE=self`（自研检索）；设为 `langchain` 时，入库切分走 LangChain `RecursiveCharacterTextSplitter`（`buildChunksWithLangChain.ts`），向量写入 `OpenAIEmbeddings`（`ragEmbeddings.ts` / `knowledgeFacade.ts`）；检索为余弦语义 + 既有「关键词 / 全文 / 混合」加权与 rerank 分支（`vectorRetrieval.ts` + `knowledgeRetrievalService.ts`）。`RAG_ENGINE_MODE=self` 时走自研分词与打分，契约与 HTTP 形状一致。与 Dify 逐项「完全等价」并不等于已全部实现；**缺口**指尚未产品化或需外接系统的能力。`RAG_LC_MULTI_QUERY` 对 **self / langchain** 均会触发多问句改写；`langchain` 下入库与检索向量均来自同一 `createRagEmbeddings()`，须保持环境变量与模型不变。启用多查询时会增加 Chat 调用与（`langchain` 下）多次 `embedQuery` 延迟，仅建议在召回质量敏感场景打开。

### 1. Query改写与知识库处理
- Query 问题自动改写、复杂问句拆分、子问题拆解、同义扩展  
  - **Kronos**：未做通用「复杂问句拆分 / 子问题 DAG」。**已补（LangChain + 自研）**：`RAG_LC_MULTI_QUERY=true` 时 `ChatOpenAI` 生成改写问句（`expandRetrievalQueries.ts`）。`RAG_ENGINE_MODE=langchain` 时向量通道对各 chunk 取多 query embedding **极大余弦**；`self` 时对自研 **bigram 语义分** 做同权极大值；关键词与 `scoreBySearchMethod` 仍以用户原始 `query` 的 `queryTerms` 参与 keyword/full_text（自研）或原始 `query` 配向量通道（langchain）。
- Query 联网全网搜索，支持知识库无结果时自动联网补全  
  - **Kronos**：**缺口**。工作流侧无「无召回则自动联网补全」编排；需外接搜索工具或自研节点。
- 全流程知识库处理：文档上传、自动清洗、自定义切片分段、重叠度配置、向量化、批量管理  
  - **Kronos**：`RagPage` + 导入弹窗支持上传/拖拽、预处理规则（空白规范化、去 URL/邮箱）、分段长度与重叠、`requestDatasetIndexingEstimate` 切片预览、批量导入与数据集 CRUD；`langchain` 模式下向量化见上。**缺口**：无 Dify 级「解析失败队列 / 批量重试 UI」的独立运维台（仅有 blocks 加载失败计数提示）。
- 知识库问题自动生成、检索参数可调优化（切片大小/Embedding/召回阈值）  
  - **Kronos**：**缺口**「根据语料自动生成测试问句」；检索侧工作流配置页可调 Top K、rerank、元数据过滤、多库选择（`config-page/index.tsx`），阈值随数据集 `retrieval_model` 与请求体传入。
- 对话知识自动沉淀：人机对话整理切片、自动入库知识库  
  - **Kronos**：**缺口**。无「一键把会话变 chunk 入库」闭环。
- 全局搜索、局部指定知识库/指定文档范围检索  
  - **Kronos**：检索 API 支持 `dataset_ids` 多库与元数据条件；无跨库「全局搜索框」独立页，管理入口为 `RagPage` 按库查看文档与块。

### 2. 多模态文档数据处理
- PDF 常规文档解析、文字/表格解析  
  - **Kronos**：服务端 `pdf-parse` 抽文本；表格为文本流，**非**结构化表格模型。
- Word（docx）结构化解析、保留标题层级  
  - **Kronos**：`mammoth` 转 HTML 再落文本，**弱于** Dify「保留标题层级」的专用结构树。
- 网页正文智能抓取、去广告去导航、纯净文本入库  
  - **Kronos**：**缺口**。当前导入链路为文件上传，无 URL 抓取管线。

### 3. 混合检索全套能力
- 原生内置 BM25 关键词检索 + Embedding 向量检索 混合检索  
  - **Kronos**：`langchain` 分支用语义向量覆盖 `semanticOverride`，关键词/全文分量仍走自研 `scoreBySearchMethod`（非经典 BM25 公式，而是分词重叠 + 加权融合）。**概念对齐、实现路径不同**。
- 多路并行召回、结果自动去重、分数加权融合  
  - **Kronos**：多数据集并行加载后统一排序；同一 chunk 单路径评分，**无**显式「多路召回再 RRF」配置项。
- 原生支持接入 Rerank 重排序模型，检索后精排提准  
  - **Kronos**：`multiple_retrieval_config.reranking_enable` 打开时走 `applyReranking`（加权启发式，非独立 cross-encoder 服务）。UI：`config-page` 与 `workflowAppStore` 默认 rerank 模型名占位。
- 可自定义召回数量、相关性过滤阈值  
  - **Kronos**：支持 Top K 与数据集侧 `score_threshold` 解析（`resolveTopK` / `resolveThreshold`）。

### 4. RAG 调试与基础效果评估
- 文档切片可视化预览、解析日志查看、失败文档排查  
  - **Kronos**：导入前 `indexing estimate` 预览块列表；详情弹窗展示文档与 chunk 文本、关键词编辑。**缺口**：无独立「解析流水线日志」下载页。
- 检索链路全调试：查看召回切片、相似度分数、Rerank 打分  
  - **Kronos**：后端返回 `score`、`matched_terms`；诊断可含 `query_variants`（多查询改写条数）。**缺口**：无前端可视化「每路分数条」调试面板。
- 生成链路全调试：完整 Prompt 上下文、模型输入输出、上下文截断日志  
  - **Kronos**：聊天流式侧有 LangChain / Mock 降级与部分遥测（`langchainChatService` / `useChatStreamController`）。**缺口**：无「单次检索-生成」合成视图与截断字节日志对齐 Dify 调试台。
- 支持多套 Prompt、多套检索配置迭代优化  
  - **Kronos**：工作流编排内多套 prompt 变量与 recall 草稿（`chatbot-prompt-editor` / `useWorkflowChatbotOrch`）；**缺口**：无内置 A/B 对比报表（见第二节）。

*迭代锚点：双引擎检索 HTTP 形状与 LangChain 分支见 `apps/server/src/rag/knowledgeRagApi.contract.test.ts`（`pnpm test -- …/knowledgeRagApi.contract.test.ts`）。*

## 二、Dify 基础支持但能力偏弱（有基础功能，无高级量化/自动化）
### 1. Query改写与知识库处理
- 知识库健康度基础检查：可查看解析失败、空文档、重复切片；**无冗余度/碎片化自动检测、健康度量化评分**
- 知识库基础版本快照/备份；**无内置A/B测试、检索性能自动对比**
  - **Kronos**：`GET /api/workflow/knowledge-datasets/:id/health` 返回空文档数、完全重复切片、同文档近重复对（Dice）、过短切片占比、中位/P90 字长及 **0–100 健康分**；Rag 详情弹窗内可刷新。`POST …/snapshots` 写入 `apps/server/data/knowledge-snapshots/{datasetId}/*.json` 元数据快照；`GET …/snapshots` 列表。`POST /api/workflow/knowledge-retrieval/compare` 对两次完整检索请求测 **延迟** 与 TopK chunk_id **Jaccard 重叠**，用于简单 A/B 与性能对比（需同一 `query` 与 `dataset_ids`）。

### 2. 多模态文档与RAG评估
- 可接入通义千问系列模型；**无内置 Qwen-Agent 专属RAG封装**
- RAG 可人工做测试集标注、人工统计召回率；**无内置 EM/F1/幻觉率 自动量化评估指标**

## 三、Dify 原生不支持，必须二次开发/外接系统才能实现
### 1. 多模态多媒体处理
- 扫描版PDF高精度OCR图文解析（需外接OCR插件/服务）
- 图像多重表征索引、细粒度图文向量检索
- 视频原生处理：抽帧、画面解析、视频内容理解
- 原生无ASR语音转文本，需外接讯飞/阿里ASR接口转文字后再进RAG

### 2. 高级RAG架构
- 内置无 GraphRAG 能力：无实体抽取、关系构建、知识图谱检索，需外接Neo4j自行开发
- 无法原生实现图像、视频、语音的端到端多模态RAG全链路

## 四、RAG 体系理论课题（Dify 可承载落地，理论通用适配）
- 混合检索底层原理、适用场景、选型方法论
- RAG 完整调试标准步骤
- RAG 检索阶段、生成阶段优化方法论
- RAG 效果评估标准维度、持续迭代优化实践

---
直接整段复制即可喂给LLM做分析、方案设计、架构落地。