# RAG 召回设置、分块、向量化与标签流转说明

本文回答 4 个问题：

1. 前端的召回设置是怎么下发到后端的
2. 后端分块和向量化按什么规则执行
3. Dify 里的“标签”到底是哪一类数据，怎么来的
4. 如果你要在另一个项目里实现，应该怎么拆

这份说明基于 Dify 当前前后端代码，不是泛泛而谈。

---

## 1. 先给结论

这条链路在 Dify 里其实分成 3 条，不是一条。

### 链路 A：知识库构建时的分块与向量化

- 前端在创建知识库 / 导入文档时，下发 `process_rule`、`indexing_technique`、`embedding_model`、`retrieval_model`
- 后端据此创建文档、保存 process rule、再走异步 indexing
- 这条链路决定“文档怎么切”和“索引怎么建”

### 链路 B：知识库命中测试 / 召回测试

- 前端下发 `retrieval_model`，包括 `top_k`、`score_threshold`、`search_method`、`reranking_*`
- 后端按这些设置执行一次 retrieve
- 这条链路决定“怎么搜”

### 链路 C：工作流里的 knowledge retrieval 节点

- 前端工作流节点下发 `dataset_ids`、`top_k`、`score_threshold`、`rerank`、`metadata filter`
- 后端按工作流节点配置做召回，再把结果回给后续 LLM 节点

所以你在别的项目里要做完整，不能只盯着“面板”。

---

## 2. 前端召回设置是怎么下发到后端的

### 2.1 数据集设置页 / 命中测试页里的召回参数

在前端，召回参数主要来自这些组件：

- [web/app/components/app/configuration/dataset-config/params-config/config-content.tsx](web/app/components/app/configuration/dataset-config/params-config/config-content.tsx)
- [web/app/components/app/configuration/dataset-config/settings-modal/retrieval-section.tsx](web/app/components/app/configuration/dataset-config/settings-modal/retrieval-section.tsx)
- [web/app/components/datasets/external-knowledge-base/create/RetrievalSettings.tsx](web/app/components/datasets/external-knowledge-base/create/RetrievalSettings.tsx)

它们维护的核心字段是：

- `search_method`
- `top_k`
- `score_threshold_enabled`
- `score_threshold`
- `reranking_enable`
- `reranking_model`
- `reranking_mode`
- `weights`

也就是一个典型的 `retrieval_model`。

### 2.2 工作流 knowledge retrieval 节点里的召回参数

工作流节点侧，前端把 UI 配置收敛到：

- `dataset_ids`
- `retrieval_mode`
- `multiple_retrieval_config.top_k`
- `multiple_retrieval_config.score_threshold`
- `multiple_retrieval_config.reranking_model`
- `multiple_retrieval_config.reranking_mode`
- `multiple_retrieval_config.weights`
- `multiple_retrieval_config.reranking_enable`
- `metadata_filtering_conditions`

入口在：

- [web/app/components/workflow/nodes/knowledge-retrieval/components/retrieval-config.tsx](web/app/components/workflow/nodes/knowledge-retrieval/components/retrieval-config.tsx)

这里的重点是：前端最终不会把一堆散字段乱发，而是会整理成一个 retrieval config 对象下发。

### 2.3 创建知识库时怎么把设置带到后端

知识库创建 / 导入文档时，前端在 [web/app/components/datasets/create/step-two/hooks/use-document-creation.ts](web/app/components/datasets/create/step-two/hooks/use-document-creation.ts) 里构建请求参数。

它下发给后端的关键字段是：

- `doc_form`
- `doc_language`
- `process_rule`
- `summary_index_setting`
- `retrieval_model`
- `embedding_model`
- `embedding_model_provider`
- `indexing_technique`
- `data_source`

所以前端不是只提交文件，还会把：

- 召回配置
- embedding 模型
- 分块规则

一起交给后端保存。

---

## 3. 后端是怎么接收这些设置的

### 3.1 后端知识配置对象

后端入口模型在：

- [api/services/entities/knowledge_entities/knowledge_entities.py](api/services/entities/knowledge_entities/knowledge_entities.py)

核心对象是 `KnowledgeConfig`，里面直接定义了：

- `indexing_technique`
- `data_source`
- `process_rule`
- `retrieval_model`
- `summary_index_setting`
- `doc_form`
- `doc_language`
- `embedding_model`
- `embedding_model_provider`

这说明后端把“知识库构建配置”视为一份完整的领域对象，不是零散字段。

### 3.2 保存知识库时如何落库

保存知识库和文档的主逻辑在：

- [api/services/dataset_service.py](api/services/dataset_service.py)

两个关键入口：

- `DatasetService.create_empty_dataset()`
- `DocumentService.save_document_with_dataset_id()`

其中：

- `create_empty_dataset()` 会保存 dataset 的 `embedding_model` 和 `retrieval_model`
- `save_document_with_dataset_id()` 会保存 process rule、文档、批次，并触发后续 indexing

也就是说，召回设置一部分是 dataset 级配置，一部分是 workflow / hit testing 的即时配置。

---

## 4. 后端分块按什么规则执行

### 4.1 默认规则

默认规则在：

- [api/services/dataset_service.py](api/services/dataset_service.py#L1212)

当前默认值大致是：

- `mode = custom`
- `pre_processing_rules = [remove_extra_spaces, remove_urls_emails]`
- `segmentation.delimiter = "\n"`
- `segmentation.max_tokens = 1024`
- `segmentation.chunk_overlap = 50`

注意一点：前端模型里常见的是 `separator`，但后端默认规则里内部字段有时写成 `delimiter`。迁移时不要机械照抄字段名，要统一你自己的协议。

### 4.2 预览时的分块流程

预览 / estimate 的执行在：

- [api/core/indexing_runner.py](api/core/indexing_runner.py)

关键流程是：

1. `index_processor.extract()` 先提取文本
2. `index_processor.transform(..., process_rule=..., preview=True)` 做清洗和分块
3. 返回 `preview`、`qa_preview`、`total_segments`

这里用到的分块器在：

- `IndexingRunner._get_splitter()`

规则是：

- `custom` / `hierarchical` 模式走用户自定义分块
- `automatic` 模式走系统默认自动分块
- `max_tokens` 必须在后端允许的范围内
- `separator` 中的 `\n` 会被转换成真实换行符

### 4.3 正式入库时的分块流程

正式入库不是走 preview，而是：

1. 文档保存到 `Document` 表
2. 绑定 `DatasetProcessRule`
3. 异步 indexing runner 启动
4. `_extract()` 提取原文
5. `_transform()` 按 process_rule 切成 segment
6. `_load_segments()` 先把 segment 落到数据库
7. `_load()` 再把向量 / 关键词索引写入索引层

主执行器还是：

- [api/core/indexing_runner.py](api/core/indexing_runner.py)

---

## 5. 后端向量化按什么规则执行

### 5.1 什么时候会做向量化

只有高质量索引，也就是：

- `indexing_technique == high_quality`

才会真正使用 embedding 模型建向量索引。

这在多个位置都能看到：

- [api/services/dataset_service.py](api/services/dataset_service.py)
- [api/services/vector_service.py](api/services/vector_service.py)

如果是 `economy`，更偏向关键词 / 低成本索引，不一定走完整向量方案。

### 5.2 向量化使用哪个 embedding 模型

模型来源规则：

1. 如果前端创建时明确传了 `embedding_model_provider + embedding_model`
2. 后端会校验并保存到 dataset
3. 后续 indexing 时从 dataset 取该模型
4. 如果没传，则尝试取默认 embedding 模型

这条逻辑在：

- [api/services/dataset_service.py](api/services/dataset_service.py)

### 5.3 向量写入在哪里发生

核心在：

- [api/services/vector_service.py](api/services/vector_service.py)

对于普通分段：

- `VectorService.create_segments_vector()` 会把 `DocumentSegment.content` 包装成 `Document`
- 然后调用 `index_processor.load(...)`

对于父子分块：

- 父 chunk 是 segment
- 子 chunk 在 `generate_child_chunks()` 中再次 transform 并写入 child chunk 索引

所以父子模式不是“单层向量”，而是多一层 child chunk 索引。

---

## 6. 召回设置是怎么真正作用到后端检索的

### 6.1 命中测试入口

命中测试主逻辑在：

- [api/services/hit_testing_service.py](api/services/hit_testing_service.py)

这里会读取 `retrieval_model`，并把这些字段传给 `RetrievalService.retrieve()`：

- `search_method`
- `top_k`
- `score_threshold`
- `reranking_model`
- `reranking_mode`
- `weights`
- `document_ids_filter`

### 6.2 真实检索入口

真实召回执行器在：

- [api/core/rag/datasource/retrieval_service.py](api/core/rag/datasource/retrieval_service.py)

这里根据 `retrieval_method` 分流到：

- `embedding_search()`
- `full_text_index_search()`
- `keyword_search()`

也就是说，前端的 `search_method` 最终决定走：

- 语义向量检索
- 全文检索
- 关键词检索
- 或混合检索

### 6.3 top_k 和 score_threshold 怎么生效

在 `embedding_search()` 里，向量检索最终会调用：

- `vector.search_by_vector(... top_k=..., score_threshold=...)`

也就是说：

- `top_k` 控制召回数量上限
- `score_threshold` 控制最低相似度阈值

### 6.4 rerank 怎么生效

如果：

- `reranking_enable = true`
- 且配置了 `reranking_model`

则检索结果会在向量 / 全文检索后进入 `DataPostProcessor.invoke()` 做 rerank。

也就是说，rerank 是召回后的二次排序，不是替代 primary retrieval。

---

## 7. “标签”在 Dify 里到底是什么

这是最容易混淆的地方。

Dify 里至少有 3 类“标签/分类信息”。

### 7.1 数据集管理标签 `dataset.tags`

这是知识库列表页上那类管理标签，主要用于：

- 分类展示
- 列表过滤
- 组织管理

它不是召回过滤的核心字段。

### 7.2 文档 metadata `doc_metadata`

这是召回过滤真正相关的那类“标签”。

例如：

- `category`
- `lang`
- `author`
- `source`
- `upload_date`

这些字段挂在 document 的 `doc_metadata` 上，并可被 metadata filter 使用。

相关代码：

- [api/services/metadata_service.py](api/services/metadata_service.py)
- [api/services/dataset_service.py](api/services/dataset_service.py)

重要结论：

- 它不是自动从 chunk 里神奇抽出来的
- 主要是文档级 metadata，来自用户配置、内置字段或文档属性

### 7.3 分段关键词 `segment.keywords`

这是段级 `keywords`，存在 `DocumentSegment.keywords` 上。

相关代码：

- [api/services/dataset_service.py](api/services/dataset_service.py#L3188)
- [api/services/vector_service.py](api/services/vector_service.py)

这个 `keywords` 是什么？

- 它不是知识库列表里的 tag
- 它是 segment 级关键词，主要用于关键词索引或辅助检索
- 在当前代码里更像“由输入/编辑显式提供”，不是默认自动抽取器

也就是说，如果你问“标签是怎么分出来的”，答案是：

- dataset tags: 管理层标签
- doc_metadata: 文档元数据字段
- segment.keywords: 段级关键词，通常需要显式提供或单独抽取

它们不是一回事。

---

## 8. metadata filter 是怎么进入召回的

在命中测试里，后端会先看：

- `retrieval_model.metadata_filtering_conditions`

相关逻辑在：

- [api/services/hit_testing_service.py](api/services/hit_testing_service.py)

它会：

1. 把 metadata filter 条件解析成结构化对象
2. 先计算符合 metadata 条件的 `document_ids_filter`
3. 再把 `document_ids_filter` 带入 `RetrievalService.retrieve()`

也就是说，metadata filter 不是后过滤，而更接近“先缩小文档范围，再召回 chunk”。

这点很重要，你在另一个项目里最好也这么做。

---

## 9. 如果你要在另一个项目里实现，建议怎么拆

建议你不要复制 Dify 的全部复杂度，而是拆成 4 层。

### 9.1 配置层

定义统一协议：

```ts
type RetrievalSettings = {
  searchMethod: 'semantic' | 'full_text' | 'keyword' | 'hybrid'
  topK: number
  scoreThresholdEnabled: boolean
  scoreThreshold: number
  rerankEnabled: boolean
  rerankModel?: {
    provider: string
    model: string
  }
}

type ChunkingSettings = {
  docForm: 'text' | 'qa' | 'parent_child'
  processRule: {
    mode: 'custom' | 'hierarchical' | 'automatic'
    preProcessingRules: Array<{ id: string, enabled: boolean }>
    segmentation: {
      separator: string
      maxTokens: number
      chunkOverlap: number
    }
    parentMode?: 'full-doc' | 'paragraph'
    subchunkSegmentation?: {
      separator: string
      maxTokens: number
      chunkOverlap: number
    }
  }
}
```

### 9.2 构建层

构建层只负责：

- extract
- clean
- split
- embed
- index

不要把 retrieval 参数混进构建逻辑里，除了 embedding 模型选择。

### 9.3 索引层

建议分两种索引：

- vector index
- keyword/full-text index

即使你第一版不做 hybrid，也把接口先留出来。

### 9.4 召回层

召回层执行顺序建议：

1. 根据 metadata filter 先缩小文档范围
2. 根据 `searchMethod` 走不同 retrieval adapter
3. 应用 `scoreThreshold`
4. 截取 `topK`
5. 可选 rerank
6. 格式化输出

---

## 10. 另一个项目里的最小可用实现

如果你想先跑通，我建议这样做。

### 第一步：只支持一种分块模式

先只做 `text` 模式：

- `separator = \n\n`
- `maxTokens = 500`
- `chunkOverlap = 80`

### 第二步：只支持一种向量策略

先只做：

- 单 embedding 模型
- 单 vector store
- 单 semantic search

### 第三步：metadata 只做文档级

先只实现：

- `category`
- `source`
- `lang`
- `createdAt`

不要一开始做 chunk 级 metadata 抽取。

### 第四步：rerank 先留接口，不急着做

第一版只保留字段：

- `rerankEnabled`
- `rerankModel`

但可以先不真正执行 rerank。

---

## 11. 你项目里最推荐的“标签”方案

如果你在另一个项目要实现“标签/过滤”，建议不要照着 Dify 的多个概念混着做。

推荐你明确拆成这 3 个层次：

### A. 数据集标签

用途：

- 列表分类
- UI 管理

不参与召回。

### B. 文档 metadata

用途：

- 召回过滤
- 条件检索

这是最关键的过滤字段。

### C. chunk keywords

用途：

- 关键词检索增强
- 高亮

可选，不是 MVP 必需。

这会让你的系统边界比 Dify 更清晰。

---

## 12. 最终结论

如果你总结成一句话：

前端下发给后端的，不只是“检索参数”，而是一整套知识配置：

- 构建时下发 `process_rule + embedding_model + retrieval_model`
- 检索时下发 `top_k + score_threshold + search_method + rerank + metadata filter`

后端执行时，又是三层分工：

- `process_rule` 决定怎么分块
- `embedding_model + indexing_technique` 决定怎么向量化
- `retrieval_model` 决定怎么召回

而“标签”在 Dify 里不是一个东西，而是：

- dataset.tags
- document.doc_metadata
- segment.keywords

如果你在另一个项目里实现，最好的做法不是硬搬 Dify，而是把这三类概念主动拆开，然后用统一协议把构建和检索解耦。
