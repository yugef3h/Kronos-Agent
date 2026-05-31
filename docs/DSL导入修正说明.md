# Dify DSL 导入修正说明

## 1. 先说结论

你的 `/Users/yuqinglong/Documents/github/dify-main/客服自动化流程.yml` 里，**真正容易把导入后的页面搞崩的，不是 DSL 顶层版本号**，而是 `knowledge-retrieval` 节点里有两处字段还在用旧格式：

1. `single_retrieval_config.model` 现在要求是一个对象，不再接受字符串。
2. `multiple_retrieval_config.reranking_model` 现在要求是一个对象或直接不写，不再接受字符串。

你当前文件里这两处分别是：

```yaml
single_retrieval_config:
  model: default-vector
  top_k: 3
  score_threshold: null

multiple_retrieval_config:
  top_k: 5
  score_threshold: null
  reranking_enable: false
  reranking_model: default-rerank
  reranking_mode: reranking_model
```

其中最危险的是：

```yaml
reranking_model: default-rerank
```

因为当前前端初始化工作流时，会直接把 `reranking_model.provider` 当对象字段去改写。如果这里实际是字符串，就很容易触发运行时异常，最终表现成你看到的 `this page couldn't load`。

## 2. 为什么我判断不是 `version` 的问题

当前后端写死的 DSL 版本是 `0.6.0`，而你的 YAML 顶层也是：

```yaml
version: 0.6.0
kind: app
```

也就是说，**至少从顶层 DSL 版本看，你这份文件没有落后于当前系统支持版本**。

另外，导入弹窗本身并不会在前端深度解析 YAML，它只是把文件原文交给后端 `apps/imports`。所以：

- 弹窗能否打开，不取决于 YAML 结构是否完美
- 真正的问题通常出在“导入成功后跳转到应用/工作流页面，前端开始初始化节点数据”的阶段

## 3. 当前代码里对应的约束

### 3.1 知识检索节点的当前类型要求

前端类型里：

```ts
type MultipleRetrievalConfig = {
  reranking_model?: {
    provider: string
    model: string
  }
}

type SingleRetrievalConfig = {
  model: ModelConfig
}
```

后端实体里也是同样的要求：

```python
class MultipleRetrievalConfig(BaseModel):
    reranking_model: RerankingModelConfig | None = None

class SingleRetrievalConfig(BaseModel):
    model: ModelConfig
```

所以这两个字段都已经不是“字符串占位符”的时代了。

### 3.2 前端为什么会直接崩

当前前端初始化工作流时有一段“兼容旧 provider”的逻辑：

```ts
if (node.data.type === BlockEnum.KnowledgeRetrieval && (node as any).data.multiple_retrieval_config?.reranking_model)
  (node as any).data.multiple_retrieval_config.reranking_model.provider = correctModelProvider(
    (node as any).data.multiple_retrieval_config?.reranking_model.provider,
  )
```

这段代码默认 `reranking_model` 是对象。

如果你的 DSL 里是：

```yaml
reranking_model: default-rerank
```

那这里就不是“给对象字段赋值”，而是“给字符串挂 `.provider`”，这正是最像页面直接炸掉的地方。

## 4. 你这份 YAML 应该怎么改

### 方案 A：按你现在的配置，做最小修正

你当前 `retrieval_mode: multiple`，并且：

```yaml
reranking_enable: false
```

那最稳妥的改法是：

1. **删掉整个 `single_retrieval_config`**
2. **删掉 `reranking_model: default-rerank`**
3. 保留 `multiple_retrieval_config` 的其他字段

建议改成这样：

```yaml
data:
  selected: false
  title: 知识检索
  type: knowledge-retrieval
  query_variable_selector:
    - trigger-1
    - llmName
  query_attachment_selector: []
  dataset_ids: []
  retrieval_mode: multiple
  multiple_retrieval_config:
    top_k: 5
    score_threshold: null
    reranking_enable: false
    reranking_mode: reranking_model
```

这是你当前场景最推荐的修法，因为它和“未启用 rerank”这个事实一致。

### 方案 B：如果你以后真的要启用 rerank

那 `reranking_model` 必须改成对象结构，形状至少要像这样：

```yaml
multiple_retrieval_config:
  top_k: 5
  score_threshold: null
  reranking_enable: true
  reranking_mode: reranking_model
  reranking_model:
    provider: your-rerank-provider
    model: your-rerank-model
```

注意：

- 这里的 `provider` / `model` 不能再写成单个字符串
- 最好直接参考“同版本 Dify 里新建一个知识检索节点后再导出的 DSL”

### 方案 C：如果你以后切到 `single` 检索模式

那 `single_retrieval_config.model` 也必须是对象结构，而不是：

```yaml
model: default-vector
```

也就是说，不能再保留你现在这个写法：

```yaml
single_retrieval_config:
  model: default-vector
  top_k: 3
  score_threshold: null
```

至少有两点要注意：

1. `model` 必须是对象
2. `top_k` / `score_threshold` 也不该继续挂在 `single_retrieval_config` 这一层，当前类型定义里 `single_retrieval_config` 只要求 `model`

如果暂时不用单路检索，**直接删掉整个 `single_retrieval_config` 是最安全的**。

## 5. 这份文件里我建议你顺手再检查的点

### 5.1 `dataset_ids` 现在是空数组

你现在是：

```yaml
dataset_ids: []
```

这不会一定导致页面崩，但会让知识检索节点本身不可用。导入后如果只是想先把页面打开，这个可以暂时保留；但如果想让流程真正工作，后续要在页面里重新绑定知识库。

### 5.2 `llm.model.provider: virtual`

你现在写的是：

```yaml
model:
  provider: virtual
  name: zhiling
  mode: chat
```

这个不一定会导致页面立刻崩，但它很可能不是当前工作区真正可用的模型 provider 标识。

如果导入后出现模型节点未配置、无法运行、模型下拉异常等问题，优先处理办法是：

1. 导入成功后手动在页面里重新选模型
2. 或者先把它替换成当前 Dify 导出文件里真实存在的 provider/name 组合

## 6. 推荐你的实际操作顺序

### 第一步

先只改 `knowledge-retrieval` 这一段：

- 删除 `single_retrieval_config`
- 删除 `reranking_model: default-rerank`

### 第二步

重新导入一次 YAML。

### 第三步

如果页面能正常打开，再进入画布里手动补：

- 知识库绑定
- rerank 模型
- LLM 模型

### 第四步

再从当前系统里重新执行一次“导出 DSL”，用新的导出文件作为后续维护基线，不要继续以旧 YAML 为母版反复改。

## 7. 最小可用替换片段

你可以把原文件中知识检索节点的这部分：

```yaml
type: knowledge-retrieval
query_variable_selector:
  - trigger-1
  - llmName
query_attachment_selector: []
dataset_ids: []
retrieval_mode: multiple
single_retrieval_config:
  model: default-vector
  top_k: 3
  score_threshold: null
multiple_retrieval_config:
  top_k: 5
  score_threshold: null
  reranking_enable: false
  reranking_model: default-rerank
  reranking_mode: reranking_model
```

替换成：

```yaml
type: knowledge-retrieval
query_variable_selector:
  - trigger-1
  - llmName
query_attachment_selector: []
dataset_ids: []
retrieval_mode: multiple
multiple_retrieval_config:
  top_k: 5
  score_threshold: null
  reranking_enable: false
  reranking_mode: reranking_model
```

## 8. 一句话判断标准

以后你再手改 Dify DSL，看到下面这种写法时就要警惕：

```yaml
some_config:
  model: some-string
```

或者：

```yaml
reranking_model: some-string
```

在当前 Dify 的工作流 DSL 里，**凡是“模型配置”这一类字段，基本都应该优先怀疑它现在已经改成对象了，而不是单个字符串**。
