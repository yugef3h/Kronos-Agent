# /datasets/indexing-estimate 实现指南

本文专门回答一个问题：如果你在另一个项目里复刻 Dify 的“分段预览”能力，而且后端没有数据库，只能用文件和 JSON 存储，那么 `/datasets/indexing-estimate` 这个接口应该怎么设计和实现。

这份说明直接对齐 Dify 当前前端的调用方式，方便你把 StepTwo 预览能力搬过去。

---

## 1. 先给结论

这个接口的职责不是“正式入库”，而是“根据当前规则做一次预估和预览”。

它应该做的是：

1. 读取当前选择的文件 / Notion 页面 / 网页内容
2. 做轻量解析
3. 按当前 `process_rule` 清洗和分段
4. 统计 token、segments、费用估算
5. 返回 preview 数据给前端展示

它不应该做的是：

- 不应该正式写入向量库
- 不应该生成最终 embedding 文件
- 不应该修改知识库元数据
- 不应该创建正式 document 记录

所以它本质上是一个“dry-run 预览接口”。

---

## 2. Dify 当前前端是怎么调用它的

调用链是明确的：

1. [web/app/components/datasets/create/step-two/index.tsx](web/app/components/datasets/create/step-two/index.tsx#L140) 里的 `updatePreview()` 调用 `estimateHook.fetchEstimate()`
2. [web/app/components/datasets/create/step-two/hooks/use-indexing-estimate.ts](web/app/components/datasets/create/step-two/hooks/use-indexing-estimate.ts#L104) 根据数据源类型触发 mutation
3. [web/service/datasets.ts](web/service/datasets.ts#L203) 发起 `POST /datasets/indexing-estimate`
4. [web/app/components/datasets/create/step-two/components/preview-panel.tsx](web/app/components/datasets/create/step-two/components/preview-panel.tsx#L49) 只负责渲染返回结果

所以你在另一个项目里，只要把这个接口的输入输出保持兼容，前端交互模式就能照搬。

---

## 3. 当前请求体结构

根据 [web/models/datasets.ts](web/models/datasets.ts#L441) 和 [web/models/datasets.ts](web/models/datasets.ts#L448)，当前前端依赖的核心结构如下。

### 3.1 请求体最小模型

```ts
type IndexingEstimateParams = {
  dataset_id: string
  doc_form: 'text_model' | 'qa_model' | 'hierarchical_model'
  doc_language: string
  process_rule: {
    mode: 'custom' | 'hierarchical'
    rules: {
      pre_processing_rules: Array<{
        id: string
        enabled: boolean
      }>
      segmentation: {
        separator: string
        max_tokens: number
        chunk_overlap?: number
      }
      parent_mode: 'full-doc' | 'paragraph'
      subchunk_segmentation: {
        separator: string
        max_tokens: number
        chunk_overlap?: number
      }
    }
    summary_index_setting?: {
      enable?: boolean
      model_name?: string
      model_provider_name?: string
      summary_prompt?: string
    }
  }
  summary_index_setting?: {
    enable?: boolean
    model_name?: string
    model_provider_name?: string
    summary_prompt?: string
  }
  info_list?: {
    data_source_type: 'upload_file' | 'notion_import' | 'website_crawl'
    file_info_list?: {
      file_ids: string[]
    }
    notion_info_list?: Array<{
      workspace_id: string
      credential_id: string
      pages: Array<{
        page_id: string
        page_name?: string
        page_icon?: string
        type: string
      }>
    }>
    website_info_list?: {
      provider: string
      job_id: string
      urls: string[]
      only_main_content?: boolean
    }
  }
}
```

### 3.2 你自己的项目可以先收敛成这个版本

如果你先只支持文件上传，建议第一版接口收敛成：

```json
{
  "dataset_id": "ds_001",
  "doc_form": "text_model",
  "doc_language": "Chinese Simplified",
  "process_rule": {
    "mode": "custom",
    "rules": {
      "pre_processing_rules": [
        { "id": "remove_extra_spaces", "enabled": true },
        { "id": "remove_urls_emails", "enabled": false }
      ],
      "segmentation": {
        "separator": "\n\n",
        "max_tokens": 500,
        "chunk_overlap": 80
      },
      "parent_mode": "paragraph",
      "subchunk_segmentation": {
        "separator": "\n",
        "max_tokens": 200,
        "chunk_overlap": 30
      }
    }
  },
  "info_list": {
    "data_source_type": "upload_file",
    "file_info_list": {
      "file_ids": ["file_001"]
    }
  }
}
```

---

## 4. 当前响应体结构

根据 [web/models/datasets.ts](web/models/datasets.ts#L231)，前端期望的返回值是：

```ts
type FileIndexingEstimateResponse = {
  total_nodes: number
  tokens: number
  total_price: number
  currency: string
  total_segments: number
  preview: Array<{
    content: string
    child_chunks: string[]
    summary?: string
  }>
  qa_preview?: Array<{
    question: string
    answer: string
  }>
}
```

### 4.1 普通文本模式响应示例

```json
{
  "total_nodes": 1,
  "tokens": 6321,
  "total_price": 0.0047,
  "currency": "USD",
  "total_segments": 18,
  "preview": [
    {
      "content": "售后服务期内，用户可在...",
      "child_chunks": [],
      "summary": "售后政策与退货规则"
    },
    {
      "content": "如需退货，请在 7 天内提交...",
      "child_chunks": []
    }
  ]
}
```

### 4.2 QA 模式响应示例

```json
{
  "total_nodes": 1,
  "tokens": 2180,
  "total_price": 0.0016,
  "currency": "USD",
  "total_segments": 6,
  "preview": [],
  "qa_preview": [
    {
      "question": "退货时间限制是多少？",
      "answer": "用户可在 7 天内申请退货。"
    }
  ]
}
```

### 4.3 Parent-Child 模式响应示例

```json
{
  "total_nodes": 1,
  "tokens": 9500,
  "total_price": 0.0071,
  "currency": "USD",
  "total_segments": 24,
  "preview": [
    {
      "content": "第一章 售后政策总则...",
      "child_chunks": [
        "售后服务期内...",
        "退货流程包括..."
      ],
      "summary": "售后政策全文摘要"
    }
  ]
}
```

---

## 5. 文件存储版后端应该怎么实现

这个接口和正式入库最大的区别是：它依赖“临时文件缓存”，而不是正式文档记录。

### 推荐临时目录结构

```txt
data/
  temp/
    uploads/
      {fileId}/
        meta.json
        source.bin
        parsed.txt
        preview.json
```

### 每个临时文件的元数据

`data/temp/uploads/{fileId}/meta.json`

```json
{
  "fileId": "file_001",
  "name": "售后政策.pdf",
  "mimeType": "application/pdf",
  "extension": "pdf",
  "size": 204800,
  "createdAt": 1710000000000,
  "parsedTextPath": "parsed.txt"
}
```

也就是说，预览接口只需要知道 `fileId`，然后去临时目录取原始文件或解析文本即可。

---

## 6. 这个接口的执行步骤

建议后端实现成下面 8 步。

### 步骤 1：校验请求体

检查：

- `dataset_id` 是否存在
- `doc_form` 是否支持
- `process_rule` 是否完整
- `info_list.data_source_type` 是否与实际字段一致
- `max_tokens` 是否越界

如果你想和前端双保险一致，可以在后端再做一次：

- `segmentation.max_tokens <= MAXIMUM_CHUNK_TOKEN_LENGTH`

### 步骤 2：读取原始内容

根据不同数据源分流：

- `upload_file`: 从临时上传目录读文件
- `notion_import`: 调第三方接口取页面内容
- `website_crawl`: 读取已爬取的页面内容

第一版建议只支持：

- `upload_file`

### 步骤 3：解析为纯文本

把不同来源统一变成：

```ts
type ParsedSource = {
  title?: string
  text: string
  sourceType: 'file' | 'notion' | 'web'
}
```

### 步骤 4：执行预处理规则

根据 `pre_processing_rules` 处理文本。

第一版至少支持两个规则：

- `remove_extra_spaces`
- `remove_urls_emails`

伪代码：

```ts
function applyPreProcessing(text: string, rules: Array<{ id: string, enabled: boolean }>) {
  let result = text

  for (const rule of rules) {
    if (!rule.enabled)
      continue

    if (rule.id === 'remove_extra_spaces')
      result = result.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')

    if (rule.id === 'remove_urls_emails')
      result = result.replace(/https?:\/\/\S+/g, '').replace(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/g, '')
  }

  return result.trim()
}
```

### 步骤 5：按模式生成 preview

#### 普通模式 `text_model`

- 根据 `segmentation.separator`
- 按 `max_tokens`
- 带 `chunk_overlap`
- 输出 `preview[].content`

#### QA 模式 `qa_model`

- 如果原始数据已经是 QA 结构，直接解析
- 如果不是 QA 结构，第一版不要强行自动生成问答
- 最稳妥是只支持显式 QA 输入

#### 父子模式 `hierarchical_model`

- 先切 parent chunks
- 再按 `subchunk_segmentation` 切 child chunks
- `preview[].content` 放 parent
- `preview[].child_chunks` 放 children

### 步骤 6：估算 token 和价格

这里是“估算”，不需要真实 embedding。

建议做法：

- 用 tokenizer 估算所有 chunk 的 token 数总和
- 根据 embedding 模型单价估算 `total_price`

例如：

```ts
const totalPrice = (tokens / 1000) * embeddingPricePer1k
```

如果你第一版没有接具体 embedding 模型计价，也可以先返回：

- `total_price = 0`
- `currency = 'USD'`

### 步骤 7：返回 preview，不正式落库

可选：为了减少重复解析，可以把本次结果缓存到临时目录。

例如：

`data/temp/uploads/{fileId}/preview.json`

但注意这只是缓存，不是正式索引数据。

### 步骤 8：记录轻量日志

建议写日志：

- 请求来源
- fileId / datasetId
- doc_form
- total_segments
- tokens
- 耗时

方便你后续排查“为什么这个文件预览很慢”。

---

## 7. 推荐的后端分层

### 路由层

```ts
POST /api/datasets/indexing-estimate
```

职责：

- 参数校验
- 调用 service
- 返回标准 JSON

### Service 层

建议拆成：

```txt
services/
  indexing-estimate-service.ts
  source-loader-service.ts
  parse-service.ts
  preprocessing-service.ts
  chunk-preview-service.ts
  token-estimate-service.ts
```

### Storage 层

```txt
storage/
  temp-upload-store.ts
  preview-cache-store.ts
```

---

## 8. 推荐伪代码

### 8.1 Controller

```ts
export async function postIndexingEstimate(req, res) {
  const payload = validateIndexingEstimatePayload(req.body)
  const result = await indexingEstimateService.run(payload)
  res.json(result)
}
```

### 8.2 Service 主流程

```ts
export async function runIndexingEstimate(payload: IndexingEstimateParams) {
  assertPayload(payload)

  const source = await loadSource(payload.info_list)
  const parsed = await parseSourceToText(source)
  const cleaned = applyPreProcessing(parsed.text, payload.process_rule.rules.pre_processing_rules)

  if (payload.doc_form === 'qa_model') {
    const qaPreview = buildQaPreview(cleaned)
    return buildQaEstimateResponse(qaPreview, payload)
  }

  if (payload.doc_form === 'hierarchical_model') {
    const preview = buildParentChildPreview(cleaned, payload.process_rule)
    return buildEstimateResponse(preview, payload)
  }

  const preview = buildTextPreview(cleaned, payload.process_rule)
  return buildEstimateResponse(preview, payload)
}
```

### 8.3 文本模式切片

```ts
function buildTextPreview(text: string, processRule: ProcessRule) {
  const { separator, max_tokens, chunk_overlap = 0 } = processRule.rules.segmentation
  const chunks = splitByTokenWindow(text, {
    separator,
    maxTokens: max_tokens,
    overlap: chunk_overlap,
  })

  return chunks.map(chunk => ({
    content: chunk.text,
    child_chunks: [],
  }))
}
```

### 8.4 父子模式切片

```ts
function buildParentChildPreview(text: string, processRule: ProcessRule) {
  const parentChunks = splitByTokenWindow(text, {
    separator: processRule.rules.segmentation.separator,
    maxTokens: processRule.rules.segmentation.max_tokens,
    overlap: processRule.rules.segmentation.chunk_overlap ?? 0,
  })

  return parentChunks.map(parent => {
    const children = splitByTokenWindow(parent.text, {
      separator: processRule.rules.subchunk_segmentation.separator,
      maxTokens: processRule.rules.subchunk_segmentation.max_tokens,
      overlap: processRule.rules.subchunk_segmentation.chunk_overlap ?? 0,
    })

    return {
      content: parent.text,
      child_chunks: children.map(child => child.text),
    }
  })
}
```

---

## 9. 与正式入库接口的边界

这个接口必须和“创建文档 / 正式索引”彻底分开。

### `/datasets/indexing-estimate`

职责：

- 试算
- 预览
- 不产生正式数据

### `/datasets/init` 或 `/datasets/:id/documents`

职责：

- 正式创建 document
- 写入 dataset 元数据
- 创建 indexing job
- 进入 parsing / splitting / indexing 正式流程

如果把这两者混在一起，你会遇到两个问题：

- 用户只是点了预览，系统却已经写了正式数据
- 用户频繁调规则，后台会不断重复正式索引，成本很高

---

## 10. 文件存储版的注意点

### 10.1 预览缓存可以有，但要短生命周期

建议缓存 30 分钟到 24 小时。

因为它只服务于“当前上传会话”，不是长期业务数据。

### 10.2 不要在预览阶段生成全量 embedding

这是最容易把系统做重的地方。

预览阶段只做：

- 文本处理
- chunk 切片
- token / 费用估算

不要做：

- embedding API 批量调用
- 正式向量索引构建

### 10.3 要允许 preview 和正式入库规则一致

最容易出错的是：

- preview 用了一套规则
- create document 又用了另一套规则

所以正式入库时必须复用同一个 `process_rule` 处理器，而不是复制一份不同逻辑。

---

## 11. 你项目里的 MVP 建议

如果你想尽快落地，建议 `/datasets/indexing-estimate` 第一版只支持这些能力：

1. 数据源只支持文件上传
2. 文档类型先支持 `txt`, `md`, `pdf`, `docx`
3. 只支持 `text_model` 和 `hierarchical_model`
4. 只支持两个预处理规则：
   - `remove_extra_spaces`
   - `remove_urls_emails`
5. 只返回：
   - `tokens`
   - `total_segments`
   - `preview`
   - `total_price`

第一版可以暂时不做：

- QA 自动预览
- summary 真实生成
- Notion / Web 数据源
- 多模型价格映射

---

## 12. 最终结论

如果你要在另一个项目里复刻 Dify 的“预览分段”能力，`/datasets/indexing-estimate` 应该被设计成一个纯后端 dry-run 接口：

- 前端只收集配置并发请求
- 后端负责读取内容、解析、清洗、分段、估算、返回 preview
- 不做正式入库
- 不做正式向量化

在“无数据库”的前提下，最适合的实现方式是：

- 上传文件先落 `data/temp/uploads/{fileId}`
- 预览接口只读临时文件
- 结果可选写 `preview.json` 做短期缓存
- 正式保存时再走正式 document ingest 流程

这样边界最清楚，也最容易维护。
