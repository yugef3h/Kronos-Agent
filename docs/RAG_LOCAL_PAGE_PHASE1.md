# RAG 本地页面当前状态

当前页面已经从“先创建知识库”切到“直接导入文件”，并且不再使用浏览器 `localStorage` 假数据，而是直接复用 server 端的文件型知识库存储。

## 已完成

- RAG 页面默认就是导入入口，不再要求先弹窗创建知识库
- 支持 TXT、DOC、DOCX、PDF、Excel 导入
- 导入时如果目标为“新建知识库”，会自动创建 dataset 再写入文档
- server 端会把原文件、解析文本、`chunks.jsonl`、文档索引落到本地目录
- 页面会展示 chunk 预览、知识库列表、当前知识库文档列表
- workflow `knowledge-retrieval` 节点直接复用同一套 dataset 数据源

## 当前边界

- 还没有 embeddings 生成与真实检索执行
- 还没有 metadata filter 编辑、rerank、命中测试
- Notion / Web 同步入口还只是占位
- 还没有 dataset 详情页与文档删除能力

## 下一阶段建议

1. 接 embeddings.jsonl 和线性扫描检索。
2. 给 dataset 增加详情页，补文档删除、重建索引、切片参数调整。
3. 把 workflow `knowledge-retrieval` 节点的实际执行接口接到这套本地数据上。