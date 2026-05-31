# 无数据库 RAG 实施指南

本文目标：基于 Dify 当前的知识库入口和检索面板设计，给出一套可以在“没有数据库，只能用文件和 JSON 存储”的另一个项目里落地的 RAG 方案。

核心约束：

- 后端不能依赖 MySQL / PostgreSQL / MongoDB 之类数据库
- 元数据、任务状态、知识库配置都落本地文件
- 文档原文、切片、索引、检索结果都要可持久化
- 最终要能让类似 `knowledgeRetrieval panel` 的工作流节点读取并使用

---

## 1. 先看 Dify 里这套 RAG 的真实边界

从现有前端实现看，这一套能力分成两个入口。

### A. 知识库入口

`DatasetNav` 只是“知识库导航和创建入口”，不是 RAG 本体。

它做的事情非常轻：

- 拉取知识库列表
- 根据知识库状态决定跳转到哪个页面
- 提供“新建知识库”入口

你在另一个项目里可以把它理解成：

- 左侧知识库导航
- 当前知识库详情入口
- 新建知识库按钮

这部分对应的 Dify 文件：

- [web/app/components/header/dataset-nav/index.tsx](web/app/components/header/dataset-nav/index.tsx)

### B. 检索节点入口

`knowledgeRetrieval panel` 才是“工作流如何使用知识库”的配置面。

从当前实现看，它的输入配置核心是：

- `query_variable_selector`: 用户问题来自哪个变量
- `query_attachment_selector`: 可选，图片或文件输入
- `dataset_ids`: 选哪些知识库
- `retrieval_mode`: 检索模式
- `multiple_retrieval_config.top_k`
- `multiple_retrieval_config.score_threshold`
- `multiple_retrieval_config.reranking_enable`
- `metadata_filtering_mode`
- `metadata_filtering_conditions`

也就是说，另一个项目要实现得“行为完整”，至少要有：

1. 知识库管理
2. 文档导入与处理
3. 检索参数配置
4. 工作流节点拿知识库做召回
5. 将召回结果输出给后续 LLM 节点

对应 Dify 文件：

- [web/app/components/workflow/nodes/knowledge-retrieval/panel.tsx](web/app/components/workflow/nodes/knowledge-retrieval/panel.tsx)
- [web/app/components/workflow/nodes/knowledge-retrieval/use-config.ts](web/app/components/workflow/nodes/knowledge-retrieval/use-config.ts)
- [web/app/components/workflow/nodes/knowledge-retrieval/types.ts](web/app/components/workflow/nodes/knowledge-retrieval/types.ts)
- [web/app/components/workflow/nodes/knowledge-retrieval/default.ts](web/app/components/workflow/nodes/knowledge-retrieval/default.ts)

---

## 2. 你的另一个项目应该怎么拆

建议拆成 5 个子系统，不要从 UI 倒推后端。

### 2.1 Knowledge Base 管理

职责：

- 创建知识库
- 修改名称、描述、图标
- 选择分段规则、索引方式、embedding 模型
- 列出知识库

### 2.2 Document Ingestion 管道

职责：

- 上传文档
- 解析文档
- 文本清洗
- 分段
- 生成 embedding
- 写入索引

### 2.3 Retrieval Engine

职责：

- 根据 query 检索 chunks
- 支持 top_k
- 支持 score_threshold
- 支持 metadata filter
- 可选 rerank

### 2.4 Workflow Adapter

职责：

- 将知识库检索能力包装成工作流节点可消费的接口
- 输入是 query selector 和 dataset_ids
- 输出是检索片段数组 `result[]`

### 2.5 File Storage Layer

职责：

- 用本地目录 + JSON + JSONL + 索引文件代替数据库
- 提供原子写入、版本控制、任务状态回写

---

## 3. 无数据库时最推荐的落地架构

如果你没有数据库，最稳妥的是“元数据 JSON + 文档文件 + chunk JSONL + 本地向量索引文件”。

### 推荐目录结构

```txt
data/
  datasets/
    datasets.json
    {datasetId}/
      meta.json
      documents/
        documents.json
        {documentId}/
          meta.json
          source/
            original.pdf
          parsed/
            content.md
            content.txt
          chunks/
            chunks.jsonl
          preview/
            preview.json
      index/
        embeddings.jsonl
        metadata.json
        vector.index
      jobs/
        {jobId}.json
      logs/
        ingest.log
```

说明：

- `datasets.json`: 全局知识库列表索引
- `meta.json`: 单知识库配置
- `documents.json`: 该知识库下文档索引
- `source/`: 原始上传文件
- `parsed/`: 解析后的纯文本或 markdown
- `chunks.jsonl`: 文档切片结果
- `embeddings.jsonl`: 每个 chunk 的向量和简要信息
- `vector.index`: 本地 ANN 索引文件
- `jobs/`: 导入、解析、索引任务状态

---

## 4. 先定义清楚你的数据模型

没有数据库时，数据模型必须尽量稳定，因为后续迁移成本很高。

### 4.1 Dataset 元数据

`data/datasets/{datasetId}/meta.json`

```json
{
  "id": "ds_001",
  "name": "产品帮助中心",
  "description": "帮助文档知识库",
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000,
  "status": "ready",
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimension": 1536
  },
  "chunking": {
    "mode": "general",
    "separator": "\n\n",
    "maxTokens": 500,
    "chunkOverlap": 80
  },
  "retrieval": {
    "defaultTopK": 5,
    "defaultScoreThreshold": 0.25,
    "rerankEnabled": false
  },
  "index": {
    "type": "hnswlib",
    "updatedAt": 1710000000000,
    "documentCount": 12,
    "chunkCount": 894
  }
}
```

### 4.2 文档元数据

`data/datasets/{datasetId}/documents/{documentId}/meta.json`

```json
{
  "id": "doc_001",
  "datasetId": "ds_001",
  "name": "售后政策.pdf",
  "extension": "pdf",
  "mimeType": "application/pdf",
  "size": 203912,
  "status": "completed",
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000,
  "sourcePath": "source/original.pdf",
  "parsedTextPath": "parsed/content.txt",
  "chunkPath": "chunks/chunks.jsonl",
  "chunkCount": 34,
  "metadata": [
    { "id": "category", "name": "category", "type": "string", "value": "policy" },
    { "id": "lang", "name": "lang", "type": "string", "value": "zh-CN" }
  ]
}
```

### 4.3 Chunk 结构

`chunks.jsonl` 每行一个 chunk：

```json
{"id":"chunk_001","documentId":"doc_001","datasetId":"ds_001","index":0,"text":"售后服务期内...","tokenCount":312,"charCount":486,"metadata":{"category":"policy","lang":"zh-CN"},"source":{"page":1,"title":"售后政策"}}
{"id":"chunk_002","documentId":"doc_001","datasetId":"ds_001","index":1,"text":"如需退换货...","tokenCount":298,"charCount":441,"metadata":{"category":"policy","lang":"zh-CN"},"source":{"page":1,"title":"售后政策"}}
```

### 4.4 Embedding 结构

`embeddings.jsonl`：

```json
{"chunkId":"chunk_001","documentId":"doc_001","datasetId":"ds_001","vector":[0.012,0.183,...],"norm":1.0,"text":"售后服务期内...","metadata":{"category":"policy","lang":"zh-CN"}}
```

如果语料小于 2 万个 chunk，可以直接扫 `embeddings.jsonl` 做余弦相似度，先不用 ANN。

---

## 5. 不用数据库时，后端应该提供哪些接口

下面这一组接口足够支撑一个 MVP，并能和工作流节点对接。

### 5.1 知识库管理

```txt
GET    /api/datasets
POST   /api/datasets
GET    /api/datasets/:datasetId
PATCH  /api/datasets/:datasetId
DELETE /api/datasets/:datasetId
```

### 5.2 文档导入

```txt
POST   /api/datasets/:datasetId/documents/upload
POST   /api/datasets/:datasetId/documents/import-text
GET    /api/datasets/:datasetId/documents
GET    /api/datasets/:datasetId/documents/:documentId
DELETE /api/datasets/:datasetId/documents/:documentId
POST   /api/datasets/:datasetId/documents/:documentId/reindex
```

### 5.3 预览与分段配置

```txt
POST   /api/datasets/:datasetId/estimate
POST   /api/datasets/:datasetId/preview-chunks
PATCH  /api/datasets/:datasetId/chunking-rule
```

### 5.4 检索与命中测试

```txt
POST   /api/datasets/:datasetId/retrieve
POST   /api/datasets/retrieve-batch
POST   /api/datasets/:datasetId/hit-test
```

### 5.5 工作流节点执行

```txt
POST   /api/workflow/knowledge-retrieval/execute
```

---

## 6. 文档导入管道该怎么做

这是你这套系统最关键的部分。

### 6.1 导入流程

完整链路建议如下：

1. 用户创建知识库
2. 用户上传文档
3. 服务端保存原始文件到 `source/`
4. 服务端创建 job 文件，状态设为 `queued`
5. 后台任务解析文档为纯文本
6. 根据 chunk 规则切片
7. 生成 preview 供前端预览
8. 调用 embedding 模型生成向量
9. 将 chunk 和 embedding 分别写入 JSONL
10. 构建或更新本地向量索引文件
11. 更新文档状态为 `completed`
12. 更新知识库总 chunkCount / documentCount

### 6.2 Job 状态文件

`data/datasets/{datasetId}/jobs/{jobId}.json`

```json
{
  "id": "job_001",
  "type": "index-document",
  "datasetId": "ds_001",
  "documentId": "doc_001",
  "status": "indexing",
  "step": "embedding",
  "progress": 72,
  "error": null,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

前端可以靠轮询读取这个 job 文件状态，不需要数据库。

### 6.3 文档解析策略

建议分类型处理：

- `txt`, `md`, `json`: 直接读取
- `pdf`: `pdf-parse` 或 Python `pymupdf`
- `docx`: `mammoth`
- `html`: `cheerio` 清洗正文
- `csv`, `xlsx`: 转成 markdown table 或结构化文本

建议把解析统一输出成：

- `parsed/content.txt`
- `parsed/content.md`

这样后续 chunker 不需要感知文件类型。

### 6.4 分段策略

最稳妥的是先做“通用文本切片”，不要一开始就上复杂 parent-child。

推荐默认值：

- `separator`: `\n\n`
- `maxTokens`: 500
- `chunkOverlap`: 80

与 Dify 当前分段规则模型是一致方向：

- `segmentation.max_tokens`
- `segmentation.chunk_overlap`

相关类型可以参考：

- [web/models/datasets.ts](web/models/datasets.ts)

### 6.5 预览机制

为了支持“分段预览”，你应该在保存前先做一次 dry-run：

```txt
原始文本 -> 清洗 -> 分段 -> 返回前 10 条 preview
```

前端显示：

- 每段内容
- token 数
- 段数总数
- 预计 embedding 成本

这一步不需要真正写入索引。

---

## 7. 没有数据库时，向量检索该怎么存

你有两种现实可行的方案。

### 方案 A：纯 JSONL + 线性扫描

适用场景：

- 语料小于 2 万 chunks
- 并发不高
- 你先追求可实现，不追求极致性能

优点：

- 极简单
- 没有额外二进制索引维护问题
- 最符合“只能文件存储”

缺点：

- 检索耗时会随语料线性增长

执行方式：

1. 读取 `embeddings.jsonl`
2. 对 query embedding 和每条 chunk vector 计算 cosine similarity
3. 排序
4. 按 threshold + top_k 截断

### 方案 B：本地文件型 ANN 索引

适用场景：

- 语料超过 2 万 chunks
- 你需要更稳定响应

推荐思路：

- 向量索引写本地文件 `vector.index`
- 元数据仍写 `embeddings.jsonl`

你可以用：

- Node: `hnswlib-node`
- Python: `hnswlib` 或 `faiss`

推荐判断线：

- MVP: 先上方案 A
- 语料增大后升级到方案 B

不要一开始做复杂双存储。先保证一致性。

---

## 8. 检索流程怎么实现

这是你最终给 `knowledgeRetrieval panel` 用的执行链路。

### 8.1 节点输入协议

建议你的工作流节点最小输入结构如下：

```json
{
  "query": "售后政策多久内可以退货？",
  "datasetIds": ["ds_001", "ds_002"],
  "retrievalMode": "multi",
  "topK": 5,
  "scoreThreshold": 0.25,
  "metadataFilter": {
    "logicalOperator": "and",
    "conditions": [
      { "field": "category", "operator": "is", "value": "policy" }
    ]
  },
  "rerank": {
    "enabled": false
  }
}
```

### 8.2 检索执行步骤

1. 根据 `datasetIds` 加载各自索引
2. 对 query 生成 embedding
3. 每个 dataset 内检索候选 chunk
4. 合并候选结果
5. 先做 metadata filter
6. 再做 score_threshold
7. 截取 top_k
8. 可选 rerank
9. 输出统一结构给后续 LLM

### 8.3 节点输出协议

你可以直接对齐 Dify 当前 `result[]` 输出思路：

```json
{
  "result": [
    {
      "content": "售后服务期内支持...",
      "title": "售后政策",
      "url": "local://doc_001#chunk_003",
      "icon": "file-text",
      "metadata": {
        "category": "policy",
        "lang": "zh-CN"
      },
      "files": []
    }
  ]
}
```

这样你的后续 Prompt 拼接层可以直接吃。

---

## 9. Prompt 拼接应该怎么做

不要把检索节点和 LLM 节点写死在一起。检索节点只负责“给证据”，LLM 节点负责“用证据回答”。

### 推荐拼接模板

```txt
你是一个基于知识库回答问题的助手。
请严格基于以下检索到的资料回答。
如果资料不足以回答，请明确说不知道，不要编造。

[资料 1]
标题: 售后政策
内容: ...

[资料 2]
标题: 退货流程
内容: ...

用户问题:
售后政策多久内可以退货？
```

### 推荐输出约束

- 回答后附引用编号
- 如果命中为空，直接走“未命中兜底回答”
- 限制上下文总 token，避免把过多 chunks 拼进去

建议规则：

- 先召回 `top_k = 8`
- 真正拼 Prompt 时最多取前 4 到 6 条

---

## 10. 如何映射到你的前端面板

你提到的理解是对的：

1. 先创建知识库
2. 导入文档
3. 解析
4. 分段预览
5. 选择索引方式
6. 保存并完成索引
7. 在知识检索节点里选择知识库并检索

建议你前端拆成三个页面，而不是一个巨页。

### 页面 A：知识库列表

对应 `DatasetNav` 的能力。

字段最少包括：

- 名称
- 描述
- 文档数
- chunk 数
- embedding 模型
- 状态
- 创建按钮

### 页面 B：知识库构建页

包含：

- 文件上传
- 文本预览
- 分段规则配置
- 预估段数
- embedding 模型选择
- 开始索引按钮
- 任务进度

### 页面 C：工作流中的知识检索节点配置页

对应 `knowledgeRetrieval panel`。

最小可实现字段：

- `query` 来源变量
- `datasetIds`
- `topK`
- `scoreThreshold`
- `metadataFilter`

第一版可以先不做：

- `query_attachment_selector`
- rerank model 配置
- 多知识库混合加权

---

## 11. 无数据库版本的后端实现建议

如果你的项目是 Node/TypeScript，我建议这样实现。

### 11.1 核心模块

```txt
server/
  routes/
    datasets.ts
    documents.ts
    retrieval.ts
    workflow.ts
  services/
    dataset-service.ts
    document-service.ts
    parse-service.ts
    chunk-service.ts
    embedding-service.ts
    index-service.ts
    retrieve-service.ts
    prompt-service.ts
  storage/
    file-store.ts
    atomic-write.ts
    jsonl.ts
  workers/
    ingest-worker.ts
```

### 11.2 必须做的基础设施

#### 原子写入

不要直接覆盖 JSON。

应该：

1. 先写临时文件 `.tmp`
2. fsync
3. rename 覆盖目标文件

否则进程中断会把索引写坏。

#### 文件锁

同一知识库的索引更新必须串行。

最简单做法：

- 每个 dataset 一把内存锁
- 或建立 `index.lock` 文件

#### 全量重建策略

没有数据库时，增量更新会让一致性更复杂。

建议第一版采用：

- 新增/删除文档后，重建该 dataset 的完整索引

代价能接受时，这比增量 patch 安全得多。

---

## 12. 关键伪代码

### 12.1 文档入库

```ts
async function ingestDocument(datasetId: string, filePath: string) {
  const document = await saveDocumentMeta(datasetId, filePath)
  updateJob(document.id, 'parsing', 10)

  const text = await parseFileToText(filePath)
  await writeText(datasetId, document.id, text)

  updateJob(document.id, 'chunking', 35)
  const chunks = chunkText(text, await getChunkRule(datasetId))
  await writeChunks(datasetId, document.id, chunks)

  updateJob(document.id, 'embedding', 60)
  const vectors = await embedChunks(chunks)
  await writeEmbeddings(datasetId, document.id, chunks, vectors)

  updateJob(document.id, 'indexing', 85)
  await rebuildDatasetIndex(datasetId)

  await markDocumentCompleted(datasetId, document.id, chunks.length)
  updateJob(document.id, 'completed', 100)
}
```

### 12.2 检索执行

```ts
async function retrieve(params: {
  query: string
  datasetIds: string[]
  topK: number
  scoreThreshold?: number
  metadataFilter?: MetadataFilter
}) {
  const queryVector = await embedQuery(params.query)
  const candidates = []

  for (const datasetId of params.datasetIds) {
    const hits = await searchDataset(datasetId, queryVector, params.topK * 3)
    candidates.push(...hits)
  }

  let filtered = applyMetadataFilter(candidates, params.metadataFilter)

  if (typeof params.scoreThreshold === 'number')
    filtered = filtered.filter(item => item.score >= params.scoreThreshold)

  filtered.sort((a, b) => b.score - a.score)
  return filtered.slice(0, params.topK)
}
```

---

## 13. 第一版应该砍掉哪些复杂度

你这个项目没有数据库，所以第一版不要试图复刻 Dify 全能力。

建议第一版只做：

- 单知识库或多知识库选择
- 文件上传
- 文本解析
- 通用 chunking
- embedding
- top_k 检索
- score_threshold
- Prompt 注入

先不做：

- 图片查询 `query_attachment_selector`
- 多种 retrieval mode 自动切换
- weighted score
- 高级 rerank model 配置
- 自动 metadata filter 生成
- 多租户权限模型
- 增量向量索引合并

这些不是 MVP 必需项，而且在无数据库下会显著增加状态管理复杂度。

---

## 14. 你的项目里最小可用版本的配置结构

工作流节点存这个 JSON 就够了：

```json
{
  "type": "knowledge-retrieval",
  "queryVariable": ["start", "user_query"],
  "datasetIds": ["ds_001"],
  "topK": 5,
  "scoreThreshold": 0.25,
  "metadataFilter": null
}
```

执行结果返回：

```json
{
  "result": [
    {
      "content": "...",
      "title": "...",
      "url": "...",
      "metadata": {},
      "score": 0.82
    }
  ]
}
```

---

## 15. 实施顺序建议

按下面顺序做，风险最低。

### 第 1 阶段：知识库与文档存储

- 建立目录结构
- 完成 `datasets.json` 和 `meta.json` 读写
- 完成文件上传和文档元数据保存

### 第 2 阶段：解析与分段

- 接入文本解析
- 接入 chunk 预览
- 保存 `chunks.jsonl`

### 第 3 阶段：embedding 与检索

- 接 embedding API
- 落 `embeddings.jsonl`
- 先实现线性扫描检索

### 第 4 阶段：工作流接入

- 实现 `knowledge-retrieval` 节点执行接口
- 输出 `result[]`
- 接入 Prompt 拼接

### 第 5 阶段：优化

- 本地 ANN 索引
- metadata filter
- rerank
- 索引增量更新

---

## 16. 风险评估

### 风险 1：文件一致性

无数据库最大风险不是“功能不够”，而是“写坏”。

必须做：

- 原子写入
- 单 dataset 串行索引更新
- 启动时索引修复检查

### 风险 2：性能上限

纯 JSONL 线性扫描在 chunk 数大时会慢。

建议阈值：

- 小于 2 万 chunks：线性扫描可接受
- 2 万到 10 万 chunks：建议上 HNSW 文件索引
- 超过 10 万 chunks：文件存储仍可做，但维护成本明显上升

### 风险 3：解析质量

PDF、扫描件、表格类文档，解析质量会直接决定召回质量。

这部分往往比向量检索更影响体验。

### 风险 4：Prompt 污染

召回过多、低质量 chunk、重复片段，会导致最终答案质量显著下降。

所以必须做：

- 去重
- 分数截断
- 最大上下文限制

---

## 17. 最终结论

你对这套流程的理解方向是对的，但真正要在另一个项目里落地，不是只做一个 `knowledgeRetrieval panel`，而是要补齐下面这条链路：

```txt
创建知识库
-> 上传文档
-> 解析文本
-> 分段预览
-> 保存分段规则
-> 生成 embedding
-> 落本地文件索引
-> 检索节点选择 datasetIds
-> 检索 chunk
-> 拼 Prompt
-> 交给 LLM 回答
```

在“没有数据库”的前提下，最现实、最稳妥、最可执行的方案是：

- 元数据用 JSON
- 大列表用 JSONL
- 原文和解析文本用文件
- 小规模先做线性向量检索
- 数据量上来后再换本地 ANN 索引文件

这条路线是能落地的，而且不会把系统复杂度拉爆。
